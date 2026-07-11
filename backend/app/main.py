import hashlib
import logging
import re
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, current_user, require_role
from app.config import get_settings
from app.contracts.analysis import ClauseRiskFinding
from app.contracts.api import (
    AnalyzeContractResponse,
    ClauseFinding,
    ContractAmbiguity,
    ContractReport,
    RiskLevel,
    RiskSummary,
)
import asyncio
import ipaddress
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from app.db import create_engine_and_sessionmaker, dispose_engine, get_session
from app.db.engine import get_sessionmaker
from app.db.base import Base
from app.db import models as _orm_models  # noqa: F401  (register tables on Base.metadata)
from app.db.models import ClauseFinding as ClauseFindingRow
from app.db.models import ContractDraft as ContractDraftRow
from app.db.models import ReviewQueueItem as ReviewQueueItemRow
from app.db.models import User as UserRow
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event
from app.logging_config import clear_request_id, configure_logging, get_request_id, set_request_id
from app.rate_limit import rate_limit
from app.observability import render_prometheus
from app.routes.admin import router as admin_router
from app.routes.analyses import router as analyses_router
from app.routes.auth import router as auth_router
from app.routes.comments import router as comments_router
from app.routes.compare import router as compare_router
from app.routes.compliance import router as compliance_router
from app.routes.contact import router as contact_router
from app.routes.exports import router as exports_router
from app.routes.feedback import router as feedback_router
from app.routes.negotiate import router as negotiate_router
from app.routes.oauth import router as oauth_router
from app.routes.reasoning import router as reasoning_router
from app.routes.reviews import router as reviews_router
from app.routes.search import router as search_router
from app.routes.simplify import router as simplify_router
from app.routes.webhooks import router as webhooks_router
from app.routes.workflow import router as workflow_router
from app.services.async_contract_analysis import AsyncContractAnalysisService
from app.services.contract_analysis import ContractAnalysisService
from app.services.contract_ingestion import ContractIngestionService
from app.services.contract_detector import ContractDetector
from app.services.contract_reporter import ContractReporter
from app.services.loophole_sweep import LoopholeSweeper
from app.services.ambiguity_sweep import AmbiguitySweeper
from app.services.contract_text_extractor import ContractTextExtractor
from app.services.copilot_advisor import (
    CopilotAdvisor,
    DISCLAIMER as COPILOT_DISCLAIMER,
    OffTopicQuestion,
)
from app.services.custom_reasoning_model import CustomReasoningModel
from app.services.reasoning import (
    FallbackChainProvider,
    KimiProvider,
    RulesBasedProvider,
)
from app.services.reasoning.rate_limiter import AsyncRateLimiter

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)
ingestion_service = ContractIngestionService(settings)
analysis_service = ContractAnalysisService()
text_extractor = ContractTextExtractor()
safer_model = CustomReasoningModel()

# Async client + provider chain are populated in lifespan().
_http_client: "httpx.AsyncClient | None" = None
_async_analysis: AsyncContractAnalysisService | None = None
_contract_reporter: ContractReporter | None = None
_loophole_sweeper: LoopholeSweeper | None = None
_ambiguity_sweeper: AmbiguitySweeper | None = None
_copilot_advisor: CopilotAdvisor | None = None
_contract_detector: ContractDetector | None = None
# id() of the event loop the current _http_client was built on. Lets us REUSE
# the client across requests on a stable server (no per-request rebuild/leak)
# while still rebuilding when a new serverless invocation brings a fresh loop.
_runtime_loop_id: int | None = None


def _ensure_runtime() -> None:
    """(Re)init the httpx client + reasoning services for THIS request.

    Vercel's ASGI adapter doesn't fire `lifespan`, AND each serverless
    invocation may use a different asyncio event loop. A cached
    `httpx.AsyncClient` from a prior invocation will be bound to a
    closed loop -> `RuntimeError: Event loop is closed` when reused.

    So: rebuild every call. httpx.AsyncClient init is cheap (~ms);
    serverless containers don't benefit from cross-request caching here
    anyway, and the previous client's network sockets close at scope end.
    """
    global _http_client, _async_analysis, _contract_reporter, _copilot_advisor, _contract_detector, _loophole_sweeper, _ambiguity_sweeper, _runtime_loop_id
    try:
        loop_id: int | None = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_id = None
    # Reuse the existing client+services if they were built on THIS loop —
    # the multiple getter calls within one request must not each rebuild and
    # orphan a client (socket/FD leak). Only rebuild on first use or when a
    # new event loop appears (fresh serverless invocation).
    if _http_client is not None and _runtime_loop_id == loop_id:
        return
    timeout = httpx.Timeout(
        connect=5.0,
        read=settings.reasoning_timeout_seconds,
        write=10.0,
        pool=5.0,
    )
    _http_client = httpx.AsyncClient(timeout=timeout)
    _runtime_loop_id = loop_id
    _async_analysis = AsyncContractAnalysisService(
        provider=_build_provider_chain(_http_client)
    )
    _contract_reporter = ContractReporter(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=180.0,
    )
    _loophole_sweeper = LoopholeSweeper(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=120.0,
    )
    _ambiguity_sweeper = AmbiguitySweeper(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=120.0,
    )
    _copilot_advisor = CopilotAdvisor(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=240.0,
    )
    _contract_detector = ContractDetector(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=20.0,
    )


def get_async_analysis() -> AsyncContractAnalysisService:
    _ensure_runtime()
    assert _async_analysis is not None
    return _async_analysis


def get_contract_reporter() -> ContractReporter | None:
    _ensure_runtime()
    return _contract_reporter


def get_loophole_sweeper() -> LoopholeSweeper | None:
    _ensure_runtime()
    return _loophole_sweeper


def get_ambiguity_sweeper() -> AmbiguitySweeper | None:
    _ensure_runtime()
    return _ambiguity_sweeper


def get_copilot_advisor() -> CopilotAdvisor | None:
    _ensure_runtime()
    return _copilot_advisor


def get_contract_detector() -> ContractDetector | None:
    _ensure_runtime()
    return _contract_detector


def _build_provider_chain(client: "httpx.AsyncClient"):
    rules = RulesBasedProvider(model_name=f"rules-fallback-of-{settings.reasoning_model}")
    if not settings.reasoning_api_key:
        return FallbackChainProvider([rules])

    # One shared limiter: primary + fallback draw on the same account budget,
    # so a burst of gather()-ed clause calls can't collectively trip 429.
    limiter = AsyncRateLimiter(settings.reasoning_max_rpm)
    primary = KimiProvider(
        client=client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        max_retries=settings.reasoning_max_retries,
        rate_limiter=limiter,
    )
    # Drop duplicate-model fallback when primary == fallback (same endpoint).
    chain = [primary]
    if settings.reasoning_model_fallback and settings.reasoning_model_fallback != settings.reasoning_model:
        chain.append(
            KimiProvider(
                client=client,
                api_key=settings.reasoning_api_key,
                model=settings.reasoning_model_fallback,
                base_url=settings.reasoning_base_url,
                max_retries=settings.reasoning_max_retries,
                rate_limiter=limiter,
            )
        )
    chain.append(rules)
    return FallbackChainProvider(chain)


async def _purge_expired_data() -> None:
    """Hard-delete contracts (and their findings/queue rows) older than the
    configured retention window. Enforces the data-retention promise in the
    privacy policy — the less we keep, the less can leak or be subpoenaed."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.retention_days)
    sm = get_sessionmaker()
    async with sm() as s:
        expired = (
            await s.execute(
                select(ContractDraftRow.id).where(ContractDraftRow.uploaded_at < cutoff)
            )
        ).scalars().all()
        if not expired:
            return
        await s.execute(delete(ReviewQueueItemRow).where(ReviewQueueItemRow.draft_id.in_(expired)))
        await s.execute(delete(ClauseFindingRow).where(ClauseFindingRow.draft_id.in_(expired)))
        await s.execute(delete(ContractDraftRow).where(ContractDraftRow.id.in_(expired)))
        await s.commit()
        logger.info("Retention sweep purged %d expired contract(s).", len(expired))


async def _retention_loop() -> None:
    # One sweep shortly after boot, then daily.
    try:
        await asyncio.sleep(60)
        await _purge_expired_data()
    except asyncio.CancelledError:
        return
    except Exception:
        logger.exception("Initial retention sweep failed.")
    while True:
        try:
            await asyncio.sleep(24 * 3600)
            await _purge_expired_data()
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("Retention sweep failed.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting backend in %s mode with reasoning provider=%s model=%s db=%s",
        settings.environment,
        settings.reasoning_provider,
        settings.reasoning_model,
        settings.database_url.split("://", 1)[0],
    )
    engine, _ = create_engine_and_sessionmaker(settings.database_url, echo=settings.db_echo)
    if settings.db_create_all_on_startup:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    global _http_client, _async_analysis, _contract_reporter, _copilot_advisor, _contract_detector, _loophole_sweeper, _ambiguity_sweeper
    timeout = httpx.Timeout(connect=5.0, read=settings.reasoning_timeout_seconds, write=10.0, pool=5.0)
    _http_client = httpx.AsyncClient(timeout=timeout)
    _async_analysis = AsyncContractAnalysisService(provider=_build_provider_chain(_http_client))
    _contract_reporter = ContractReporter(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=180.0,
    )
    _loophole_sweeper = LoopholeSweeper(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=120.0,
    )
    _ambiguity_sweeper = AmbiguitySweeper(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=120.0,
    )
    _copilot_advisor = CopilotAdvisor(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=240.0,
    )
    _contract_detector = ContractDetector(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=20.0,
    )

    retention_task = asyncio.create_task(_retention_loop())

    try:
        yield
    finally:
        retention_task.cancel()
        try:
            await retention_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        if _http_client is not None:
            await _http_client.aclose()
        _http_client = None
        _async_analysis = None
        _contract_reporter = None
        _copilot_advisor = None
        _contract_detector = None
        await dispose_engine()


# Gate introspection in production — no /openapi.json, /docs, /redoc.
_is_prod = settings.environment.lower() == "production"
app = FastAPI(
    title=settings.project_name,
    version="0.1.0-phase1",
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    """Defense-in-depth response headers."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=()",
    )
    if _is_prod:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
        )
    return response

_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
# Pin to our own origins only. The previous regex trusted EVERY *.vercel.app
# and *.ondigitalocean.app origin with credentials, i.e. any app a stranger
# deploys there. Allow just clarifyd.app (+ www) and our specific DO frontend
# app hostname (clarifyd-frontend-<id>.ondigitalocean.app).
_cors_origin_regex = (
    r"https://(www\.)?clarifyd\.app|"
    r"https://clarifyd-frontend-[a-z0-9]+\.ondigitalocean\.app"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(reviews_router)
app.include_router(analyses_router)
app.include_router(feedback_router)
app.include_router(contact_router)
app.include_router(exports_router)
app.include_router(admin_router)
app.include_router(reasoning_router)
app.include_router(compliance_router)
app.include_router(simplify_router)
app.include_router(negotiate_router)
app.include_router(compare_router)
app.include_router(search_router)
app.include_router(comments_router)
app.include_router(workflow_router)
app.include_router(webhooks_router)
_analyze_limiter = rate_limit("analyze.contract", limit_attr="rate_limit_analyze_per_min")

# Global cap on simultaneous contract analyses. Each analysis is a long
# (~10-18s), CPU/IO-heavy LLM fan-out; on a single small instance, letting
# unlimited uploads run at once makes them all queue past the timeout. Cap
# the count and shed excess with a fast 429 "busy, retry" instead.
_ANALYZE_MAX_CONCURRENCY = 4
_analyze_sem = asyncio.Semaphore(_ANALYZE_MAX_CONCURRENCY)

# Max time to wait for the whole-contract loophole/ambiguity sweeps AFTER the
# per-clause loop has finished. The sweeps run concurrently with that loop, so
# this is only the leftover tail. Bounds cold-path latency when the provider is
# throttled — the sweeps are supplementary, so a slow one is dropped, not waited
# on (their own internal timeout is 120s, far too long to block a response).
_SWEEP_AWAIT_BUDGET_S = 20.0


async def _analyze_slot():
    try:
        await asyncio.wait_for(_analyze_sem.acquire(), timeout=0.5)
    except asyncio.TimeoutError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message="The analyzer is busy right now — please try again in a few seconds.",
            status_code=429,
        ) from exc
    try:
        yield
    finally:
        _analyze_sem.release()


# Vercel's ASGI adapter never fires the lifespan event, so the
# Base.metadata.create_all() inside lifespan() doesn't run on serverless.
# Track whether we've ever created tables for the current DB URL and run
# create_all on demand from the first request.
_DB_TABLES_READY: set[str] = set()


async def _ensure_db_tables() -> None:
    if settings.database_url in _DB_TABLES_READY:
        return
    try:
        engine, _ = create_engine_and_sessionmaker(
            settings.database_url, echo=settings.db_echo
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()
        _DB_TABLES_READY.add(settings.database_url)
    except Exception:  # pragma: no cover — never block the request on init
        logger.exception("DB create_all on cold start failed.")


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    request_id = request.headers.get("x-request-id") or uuid4().hex
    set_request_id(request_id)
    started = perf_counter()
    response = None
    try:
        await _ensure_db_tables()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        duration_ms = round((perf_counter() - started) * 1000, 2)
        status_code = response.status_code if response is not None else 500
        logger.info("%s %s -> %s (%sms)", request.method, request.url.path, status_code, duration_ms)
        clear_request_id()


@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    logger.warning("Application error on %s: %s", request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code.value,
                "message": exc.message,
                "details": exc.details,
                "request_id": get_request_id(),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Validation error on %s", request.url.path)
    # Pydantic/Starlette stuff a raw exception object into some issues' `ctx`
    # (e.g. ValueError("Expected UploadFile, received: str") for a bad
    # multipart field). That object isn't JSON-serializable and would crash
    # JSONResponse below, turning a clean 422 into a 500. Stringify any such
    # non-primitive ctx value.
    def _serializable_issue(issue: dict) -> dict:
        ctx = issue.get("ctx")
        if isinstance(ctx, dict):
            issue = {
                **issue,
                "ctx": {
                    k: (v if isinstance(v, (str, int, float, bool, type(None))) else str(v))
                    for k, v in ctx.items()
                },
            }
        return issue

    issues = [_serializable_issue(i) for i in exc.errors()]
    first_issue = issues[0] if issues else {}
    loc = first_issue.get("loc", [])
    loc_suffix = (
        f" ({' -> '.join(str(part) for part in loc[1:])})"
        if isinstance(loc, list) and len(loc) > 1
        else ""
    )
    first_msg = first_issue.get("msg")
    human_message = (
        f"Request validation failed{loc_suffix}: {first_msg}"
        if isinstance(first_msg, str) and first_msg
        else "Request validation failed."
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": ErrorCode.request_validation_error.value,
                "message": human_message,
                "details": {"issues": issues},
                "request_id": get_request_id(),
            }
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": ErrorCode.internal_error.value,
                "message": "Internal server error.",
                "details": {},
                "request_id": get_request_id(),
            }
        },
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "phase": "week-1-foundation",
        "reasoning_provider": settings.reasoning_provider,
    }


@app.get("/metrics")
def metrics():  # noqa: ANN201
    from fastapi.responses import PlainTextResponse

    return PlainTextResponse(render_prometheus(), media_type="text/plain; version=0.0.4")


@app.get("/infra/policy-check")
def policy_check(fail: bool = False) -> dict[str, str]:
    if fail:
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Policy check failed for requested operation.",
            status_code=400,
            details={"policy": "backend-infra-baseline"},
        )
    return {"status": "ok", "policy": "backend-infra-baseline"}


_MAX_CONTENT_LENGTH_HEADER_SLACK = 1024  # tolerate small multipart envelope overhead


def _parse_content_length(header: str | None) -> int | None:
    if not header:
        return None
    try:
        value = int(header)
    except ValueError:
        return None
    return value if value >= 0 else None


@app.post(
    "/analyze/contract",
    response_model=AnalyzeContractResponse,
    dependencies=[Depends(_analyze_limiter), Depends(_analyze_slot)],
)
async def analyze_contract(
    request: Request,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> AnalyzeContractResponse:
    if not file.filename:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Missing file name.",
            status_code=422,
        )

    declared_size = _parse_content_length(request.headers.get("content-length"))
    cap = ingestion_service.max_upload_file_size
    if declared_size is not None and declared_size > cap + _MAX_CONTENT_LENGTH_HEADER_SLACK:
        max_mb = cap // (1024 * 1024)
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=f"File exceeds {max_mb}MB upload limit",
            status_code=413,
        )

    file_bytes = await file.read()
    try:
        upload = ingestion_service.inspect_upload(file.filename, file_bytes)
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=str(exc),
            status_code=422,
        ) from exc

    try:
        contract_text = text_extractor.extract_text(upload.canonical_name, file_bytes)
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=str(exc),
            status_code=422,
        ) from exc

    return await _analyze_and_persist(
        contract_text,
        canonical_name=upload.canonical_name,
        sha256=upload.sha256,
        size_bytes=upload.size_bytes,
        mime=upload.mime,
        user=user,
        session=session,
    )


async def _analyze_and_persist(
    contract_text: str,
    *,
    canonical_name: str,
    sha256: str,
    size_bytes: int,
    mime: str,
    user: AuthenticatedUser,
    session: AsyncSession,
) -> AnalyzeContractResponse:
    """Shared pipeline: analyze text -> persist draft/findings/queue -> build response.

    Used by file upload, pasted text, and URL fetch entry points.
    """
    # Gate: refuse documents that aren't contracts before burning Kimi tokens
    # on per-clause analysis and the reporter.
    detector = get_contract_detector()
    if detector is not None:
        detection = await detector.classify(contract_text)
        if not detection.is_contract:
            raise AppError(
                code=ErrorCode.not_a_contract,
                message=detection.reason
                or "This document doesn't look like a contract.",
                status_code=422,
                details={"confidence": f"{detection.confidence:.2f}"},
            )

    # Match existing draft only for THIS user; never reuse another owner's draft
    # for the same sha — keeps queue, findings, and ownership strictly per-account.
    existing = (
        await session.execute(
            select(ContractDraftRow).where(
                ContractDraftRow.sha256 == sha256,
                ContractDraftRow.deleted_at.is_(None),
                ContractDraftRow.owner_id == user.id,
            )
        )
    ).scalar_one_or_none()

    # ----- #2 parallel reporter --------------------------------------------
    # Kick off the full-contract reporter NOW, in parallel with the per-clause
    # analysis + every DB write below. Saves ~50 % cold-path latency because
    # the reporter LLM call (~15 s) overlaps with the per-clause loop (~15 s)
    # instead of running sequentially.
    #
    # The reporter gets its OWN AsyncSession from the sessionmaker — async
    # SQLAlchemy sessions are not coroutine-safe for concurrent writes, and
    # the main session is busy with finding/audit/draft writes throughout
    # this handler. Reporter's own session handles ReportCache I/O and
    # commits independently.
    #
    # If the rules-based pre-screen below finds no high/critical clauses
    # (#3), we cancel the in-flight reporter task — the local httpx request
    # is aborted, NIM may still complete server-side but we don't wait on it.
    reporter = get_contract_reporter()
    reporter_task: "asyncio.Task[ContractReport | None] | None" = None
    if reporter is not None:
        async def _run_reporter_isolated() -> ContractReport | None:
            # On serverless we must build a fresh engine bound to THIS
            # coroutine's loop. Reusing the request session would be a race
            # (the request session is being written to concurrently), and
            # reusing a cached module-level sessionmaker would bind us to
            # whatever loop made it (often dead in the next invocation).
            engine = None
            try:
                from app.db.session import IS_SERVERLESS, build_request_scoped_engine
                if IS_SERVERLESS:
                    engine, sessionmaker = build_request_scoped_engine()
                else:
                    sessionmaker = get_sessionmaker()
            except Exception:  # pragma: no cover — DB not initialised
                # Degrade to cache-bypass mode rather than fail the request.
                return await asyncio.wait_for(
                    reporter.generate(contract_text), timeout=240.0
                )
            try:
                async with sessionmaker() as own_session:
                    rep = await asyncio.wait_for(
                        reporter.generate(contract_text, session=own_session),
                        timeout=240.0,
                    )
                    try:
                        await own_session.commit()
                    except Exception:  # pragma: no cover — cache write race
                        await own_session.rollback()
                    return rep
            except asyncio.TimeoutError:
                logger.warning("Reporter timed out after 240s — rules-only response.")
                return None
            except asyncio.CancelledError:
                raise
            except Exception:  # pragma: no cover — never block the response
                logger.exception("Reporter task failed.")
                return None
            finally:
                if engine is not None:
                    try:
                        await engine.dispose()
                    except Exception:  # pragma: no cover — best-effort cleanup
                        pass

        reporter_task = asyncio.create_task(_run_reporter_isolated())

    # Whole-contract loophole sweep, runs concurrently with the per-clause
    # analyzer + the reporter. Catches multi-issue clauses (per-clause only
    # ever emits ONE finding) and loopholes from ABSENT clauses (no exit
    # obligations, missing IP assignment, no data return on termination,
    # etc.) — which per-clause analysis is structurally blind to.
    sweeper = get_loophole_sweeper()
    sweep_task: "asyncio.Task[list[ClauseRiskFinding]] | None" = None
    if sweeper is not None:
        sweep_task = asyncio.create_task(sweeper.sweep(contract_text))

    # Whole-contract ambiguity sweep — vague / undefined / open-to-interpretation
    # language. Runs concurrently; surfaced separately from risk findings.
    ambiguity_sweeper = get_ambiguity_sweeper()
    ambiguity_task: "asyncio.Task[list[ContractAmbiguity]] | None" = None
    if ambiguity_sweeper is not None:
        ambiguity_task = asyncio.create_task(ambiguity_sweeper.sweep(contract_text))

    try:
        analysis_with_flags = await get_async_analysis().analyze(contract_text, session=session)
    except BaseException as exc:
        # Don't leave the concurrent sweep/reporter tasks orphaned (they'd
        # log "task was never retrieved" and keep burning an LLM call).
        for t in (sweep_task, ambiguity_task, reporter_task):
            if t is not None:
                t.cancel()
        if isinstance(exc, ValueError):
            raise AppError(
                code=ErrorCode.upload_rejected,
                message=str(exc),
                status_code=422,
            ) from exc
        raise
    analysis = analysis_with_flags.result
    injection_flags = analysis_with_flags.injection_flags

    # Merge sweep findings into per-clause findings. Dedupe is best-effort:
    # we drop any sweep item whose title materially matches an existing
    # finding's clause text (case-insensitive substring on the first 6 words).
    if sweep_task is not None:
        try:
            # The sweep has already overlapped the per-clause loop above, so
            # it's usually done by now. Cap the *remaining* wait: under provider
            # throttling the sweep can otherwise run toward its own 120s
            # internal timeout and stretch cold-path latency. Supplementary
            # finding — drop it rather than make the founder wait.
            sweep_findings = await asyncio.wait_for(
                sweep_task, timeout=_SWEEP_AWAIT_BUDGET_S
            )
        except asyncio.TimeoutError:
            logger.warning(
                "LoopholeSweep exceeded %ss await budget — skipping.",
                _SWEEP_AWAIT_BUDGET_S,
            )
            sweep_task.cancel()
            sweep_findings = []
        except Exception:  # pragma: no cover — never fail the request on sweep
            logger.exception("LoopholeSweep task failed.")
            sweep_findings = []
        if sweep_findings:
            seen = {(f.clause.text or "").strip().lower()[:60] for f in analysis.findings}
            for s in sweep_findings:
                key = (s.clause.text or "").strip().lower()[:60]
                if key and key not in seen:
                    analysis.findings.append(s)
                    seen.add(key)
    # Surface medium/high/critical first. If Kimi was rate-limited and every
    # clause fell through to the rules-based provider with severity=low, the
    # UI was showing zero flags. Fall back to ALL findings (incl. low) so the
    # user can still see what we extracted instead of an empty Findings page.
    # Keep every finding regardless of severity, ranked critical->low, so a
    # low-rated loophole isn't dropped just because the contract also has a
    # high one. Users complained that 2 real loopholes vanished from the UI
    # because they got rated "low" and the page only showed the medium+ set.
    _RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    # Drop benign boilerplate: a low-severity clause with a trivial risk
    # score is standard, reasonable language — showing it as a "flag" makes
    # a clean contract look alarming (21 flags on a sound founders' agreement).
    # Keep low-severity findings that still carry a non-trivial score (the
    # real-but-minor loopholes users complained were missing).
    surfaced = [
        f
        for f in analysis.findings
        if not (f.severity.value == "low" and f.risk_score <= 2)
    ]
    important_findings = sorted(
        surfaced,
        key=lambda f: _RANK.get(f.severity.value, 0),
        reverse=True,
    )

    if existing is not None:
        await session.execute(
            delete(ReviewQueueItemRow).where(ReviewQueueItemRow.draft_id == existing.id)
        )
        await session.execute(
            delete(ClauseFindingRow).where(ClauseFindingRow.draft_id == existing.id)
        )
        await session.flush()
        draft_row = existing
        draft_row.status = "ready_for_processing"
        draft_row.file_name = canonical_name
        draft_row.file_size_bytes = size_bytes
        draft_row.mime = mime
        await append_audit_event(
            session,
            action="upload.reanalyzed",
            target_type="contract_draft",
            target_id=draft_row.id,
            actor_id=user.id,
            payload={"sha256": sha256},
        )
    else:
        draft_row = ContractDraftRow(
            file_name=canonical_name,
            file_size_bytes=size_bytes,
            sha256=sha256,
            mime=mime,
            status="ready_for_processing",
            owner_id=user.id,
        )
        session.add(draft_row)
    await session.flush()

    auto_route_severities = {
        s.strip().lower()
        for s in settings.review_auto_route_severities.split(",")
        if s.strip()
    }
    finding_rows: list[ClauseFindingRow] = []
    queued_count = 0
    for index, finding in enumerate(important_findings, start=1):
        row = ClauseFindingRow(
            draft_id=draft_row.id,
            finding_id=f"finding-{index}",
            clause_name=finding.clause.clause_type.value,
            excerpt=finding.clause.text,
            risk_level=finding.severity.value,
            risk_score=finding.risk_score,
            confidence=finding.confidence,
            explanation=finding.rationale,
            safer_language=safer_model.safer_language_for(finding.clause.clause_type),
            injection_suspected=injection_flags.get(finding.clause.clause_id, False),
        )
        session.add(row)
        finding_rows.append(row)
    await session.flush()

    for row in finding_rows:
        needs_review = (
            row.risk_level.lower() in auto_route_severities
            or row.confidence < settings.review_confidence_threshold
            or row.injection_suspected
        )
        if needs_review:
            session.add(ReviewQueueItemRow(draft_id=draft_row.id, finding_id=row.id))
            queued_count += 1
    if queued_count:
        await session.flush()

    await append_audit_event(
        session,
        action="upload.created",
        target_type="contract_draft",
        target_id=draft_row.id,
        actor_id=user.id,
        payload={
            "sha256": sha256,
            "size": size_bytes,
            "findings": len(finding_rows),
            "queued_for_review": queued_count,
        },
    )
    await session.commit()

    # The reporter has been running in parallel since the top of this handler
    # (#2). Decide whether to keep its result or cancel based on whether the
    # rules pre-screen surfaced anything serious (#3).
    has_serious = any(
        (row.risk_level or "").lower() in {"high", "critical"}
        for row in finding_rows
    )
    report = None
    if reporter_task is not None:
        if not has_serious:
            # Rules-based pre-screen found nothing high/critical. The reporter
            # has nothing to add on a clean NDA / SOW — cancel the in-flight
            # task. The local httpx request is aborted; NIM may still complete
            # server-side but we don't wait on it.
            reporter_task.cancel()
            try:
                await reporter_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
            logger.info(
                "Skipping reporter (cancelled in-flight) — rules found 0 "
                "high/critical findings on draft %s.",
                draft_row.id,
            )
        else:
            try:
                # Reporter may already be complete (parallel kickoff), in
                # which case this returns immediately. Otherwise we wait for
                # the remaining LLM time minus whatever overlapped with the
                # per-clause loop + DB writes.
                report = await reporter_task
            except Exception:  # pragma: no cover — never block the response
                logger.exception("Awaiting reporter task failed.")
                report = None

    ambiguities: list[ContractAmbiguity] = []
    if ambiguity_task is not None:
        try:
            ambiguities = await asyncio.wait_for(
                ambiguity_task, timeout=_SWEEP_AWAIT_BUDGET_S
            )
        except asyncio.TimeoutError:
            logger.warning(
                "AmbiguitySweep exceeded %ss await budget — skipping.",
                _SWEEP_AWAIT_BUDGET_S,
            )
            ambiguity_task.cancel()
            ambiguities = []
        except Exception:  # pragma: no cover — never block the response on sweep
            logger.exception("Awaiting ambiguity sweep failed.")
            ambiguities = []

    response = _build_response(
        draft_row,
        finding_rows,
        report=report,
        ambiguities=ambiguities,
        extracted_text=contract_text,
    )
    # Persist the full response so the Findings tab can rehydrate it on any
    # device or origin (browser localStorage is per-origin and ephemeral).
    try:
        draft_row.analysis_json = response.model_dump_json()
        await session.commit()
    except Exception:  # pragma: no cover — never block the response on storage
        logger.exception("Failed to persist analysis_json for draft %s", draft_row.id)
        await session.rollback()
    return response


class AnalyzeTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=40, max_length=400_000)
    source_name: str = Field(default="Pasted contract", min_length=1, max_length=160)


class AnalyzeUrlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=8, max_length=2048)


@app.post(
    "/analyze/text",
    response_model=AnalyzeContractResponse,
    dependencies=[Depends(_analyze_limiter), Depends(_analyze_slot)],
)
async def analyze_text(
    body: AnalyzeTextRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> AnalyzeContractResponse:
    text = body.text.strip()
    if len(text) < 40:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Pasted text is too short to analyze.",
            status_code=422,
        )
    raw = text.encode("utf-8")
    sha = hashlib.sha256(raw).hexdigest()
    name = body.source_name.strip() or "Pasted contract"
    if not name.lower().endswith(".txt"):
        name = f"{name}.txt"
    return await _analyze_and_persist(
        text,
        canonical_name=name,
        sha256=sha,
        size_bytes=len(raw),
        mime="text/plain",
        user=user,
        session=session,
    )


async def _assert_public_url(url: str) -> None:
    """Reject URLs that resolve to non-public addresses (SSRF guard)."""
    parsed = urlparse(url)
    host = parsed.hostname
    if not host:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Invalid URL.",
            status_code=422,
        )
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in (80, 443):
        raise AppError(
            code=ErrorCode.upload_rejected,
            message="Only standard web ports (80/443) are allowed.",
            status_code=422,
        )
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port)
    except OSError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message="Could not resolve the URL's host.",
            status_code=422,
        ) from exc
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise AppError(
                code=ErrorCode.upload_rejected,
                message="That URL points to a private or internal address.",
                status_code=422,
            )


@app.post(
    "/analyze/url",
    response_model=AnalyzeContractResponse,
    dependencies=[Depends(_analyze_limiter), Depends(_analyze_slot)],
)
async def analyze_url(
    body: AnalyzeUrlRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> AnalyzeContractResponse:
    url = body.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="URL must start with http:// or https://.",
            status_code=422,
        )
    if _http_client is None:
        raise AppError(
            code=ErrorCode.internal_error,
            message="HTTP client not initialized.",
            status_code=503,
        )
    # SSRF guard: resolve the host and refuse anything that maps to a
    # private / loopback / link-local / metadata address, restrict ports,
    # and never follow redirects (a public URL could 30x into the internal
    # network). DNS is resolved here and the fetch targets the same host, so
    # a rebind would have to beat this check within the request.
    await _assert_public_url(url)
    try:
        resp = await _http_client.get(url, timeout=20.0, follow_redirects=False)
    except httpx.HTTPError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=f"Could not fetch the URL: {exc}",
            status_code=422,
        ) from exc
    if 300 <= resp.status_code < 400:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message="URL redirects are not allowed — provide a direct link.",
            status_code=422,
        )
    if resp.status_code >= 400:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=f"URL returned HTTP {resp.status_code}.",
            status_code=422,
        )

    cap = ingestion_service.max_upload_file_size
    raw = resp.content
    if len(raw) > cap:
        max_mb = cap // (1024 * 1024)
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=f"Document at URL exceeds {max_mb}MB limit.",
            status_code=413,
        )

    content_type = (resp.headers.get("content-type") or "").lower()
    lower_url = url.lower().split("?", 1)[0]
    name = lower_url.rsplit("/", 1)[-1] or "contract-from-url"
    try:
        if lower_url.endswith(".pdf") or "application/pdf" in content_type:
            if not name.endswith(".pdf"):
                name += ".pdf"
            contract_text = text_extractor.extract_text(name, raw)
        elif lower_url.endswith(".docx") or "wordprocessingml" in content_type:
            if not name.endswith(".docx"):
                name += ".docx"
            contract_text = text_extractor.extract_text(name, raw)
        else:
            # Treat as plain text / HTML body.
            contract_text = raw.decode("utf-8", errors="ignore")
            if "<html" in contract_text.lower() or "<body" in contract_text.lower():
                contract_text = re.sub(r"<[^>]+>", " ", contract_text)
            contract_text = re.sub(r"\s+", " ", contract_text).strip()
            if not name.endswith(".txt"):
                name += ".txt"
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=str(exc),
            status_code=422,
        ) from exc

    if len(contract_text.strip()) < 40:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message="Could not extract enough contract text from that URL.",
            status_code=422,
        )
    sha = hashlib.sha256(contract_text.encode("utf-8")).hexdigest()
    return await _analyze_and_persist(
        contract_text,
        canonical_name=name,
        sha256=sha,
        size_bytes=len(raw),
        mime=content_type.split(";", 1)[0] or "text/plain",
        user=user,
        session=session,
    )


def _build_response(
    draft: ContractDraftRow,
    findings: list[ClauseFindingRow],
    *,
    report: "ContractReport | None" = None,
    ambiguities: list[ContractAmbiguity] | None = None,
    extracted_text: str | None = None,
) -> AnalyzeContractResponse:
    api_findings = [
        ClauseFinding(
            finding_id=row.finding_id,
            clause_name=row.clause_name,
            excerpt=row.excerpt,
            risk_level=RiskLevel(row.risk_level),
            risk_score=int(row.risk_score) * 10,  # 1-10 internal → 1-100 API
            confidence=row.confidence,
            explanation=row.explanation,
            safer_language=row.safer_language,
        )
        for row in findings
    ]
    if findings:
        highest = max(findings, key=lambda r: r.risk_score)
        overall_score = int(highest.risk_score) * 10
        highest_risk = RiskLevel(highest.risk_level)
    else:
        overall_score = 1
        highest_risk = RiskLevel.low
    return AnalyzeContractResponse(
        draft_id=draft.id,
        status=draft.status,
        summary=RiskSummary(
            overall_score=overall_score,
            highest_risk=highest_risk,
            findings_count=len(api_findings),
        ),
        findings=api_findings,
        report=report,
        ambiguities=ambiguities or [],
        extracted_text=extracted_text,
    )


class CopilotMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class CopilotGuidanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=8000)
    history: list[CopilotMessage] = Field(default_factory=list)
    mode: str = Field(default="template", pattern="^(template|custom|chat)$")
    # One-line founder/company context from onboarding so the advisor never
    # re-asks the basics (name, company, stage, sector, jurisdiction).
    startup_profile: str | None = Field(default=None, max_length=1000)


class CopilotGuidanceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str
    model: str
    not_legal_advice: bool = True
    disclaimer: str = COPILOT_DISCLAIMER


@app.post("/api/v1/copilot/guidance", response_model=CopilotGuidanceResponse)
async def copilot_guidance(
    body: CopilotGuidanceRequest,
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> CopilotGuidanceResponse:
    advisor = get_copilot_advisor()
    if advisor is None:
        raise AppError(
            code=ErrorCode.internal_error,
            message="Co-Pilot advisor not initialized.",
            status_code=503,
        )
    try:
        reply = await advisor.chat(
            template=body.template,
            history=[m.model_dump() for m in body.history],
            message=body.message,
            mode=body.mode,
            startup_profile=body.startup_profile,
        )
    except OffTopicQuestion as exc:
        raise AppError(
            code=ErrorCode.off_topic_question,
            message=exc.reason,
            status_code=422,
        ) from exc
    return CopilotGuidanceResponse(reply=reply, model=advisor.model)


@app.post("/api/v1/copilot/guidance/stream")
async def copilot_guidance_stream(
    body: CopilotGuidanceRequest,
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> StreamingResponse:
    advisor = get_copilot_advisor()
    if advisor is None:
        raise AppError(
            code=ErrorCode.internal_error,
            message="Co-Pilot advisor not initialized.",
            status_code=503,
        )
    # Reject off-topic chat BEFORE opening the stream — a 422 can't be sent
    # cleanly once the streaming response has started.
    reason = advisor.off_topic_reason(body.message, body.mode)
    if reason:
        raise AppError(
            code=ErrorCode.off_topic_question,
            message=reason,
            status_code=422,
        )
    history = [m.model_dump() for m in body.history]

    async def gen():
        async for chunk in advisor.chat_stream(
            template=body.template,
            history=history,
            message=body.message,
            mode=body.mode,
            startup_profile=body.startup_profile,
        ):
            yield chunk

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.delete("/auth/account")
async def delete_my_account(
    user: AuthenticatedUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    """Right-to-erasure: the signed-in user deletes their own account and all
    their contracts/findings — from our DB and from Clerk (source of truth)."""
    from app.routes.admin import _clerk_delete_user

    drafts = (
        await session.execute(
            select(ContractDraftRow.id).where(ContractDraftRow.owner_id == user.id)
        )
    ).scalars().all()
    if drafts:
        await session.execute(delete(ReviewQueueItemRow).where(ReviewQueueItemRow.draft_id.in_(drafts)))
        await session.execute(delete(ClauseFindingRow).where(ClauseFindingRow.draft_id.in_(drafts)))
        await session.execute(delete(ContractDraftRow).where(ContractDraftRow.id.in_(drafts)))
    await session.execute(delete(UserRow).where(UserRow.id == user.id))
    await append_audit_event(
        session,
        action="account.self_deleted",
        target_type="user",
        target_id=user.id,
        actor_id=user.id,
        payload={"drafts_purged": len(drafts)},
    )
    await session.commit()
    await _clerk_delete_user(user.id)
    return {"deleted": True}


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "AI Contract Risk Analyzer backend scaffold is running.",
        "note": "Week 1 API contracts and backend infra baseline are in place.",
    }
