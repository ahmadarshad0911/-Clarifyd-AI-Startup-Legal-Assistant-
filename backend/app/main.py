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
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.config import get_settings
from app.contracts.api import (
    AnalyzeContractResponse,
    ClauseFinding,
    ContractReport,
    RiskLevel,
    RiskSummary,
)
from app.db import create_engine_and_sessionmaker, dispose_engine, get_session
from app.db.base import Base
from app.db import models as _orm_models  # noqa: F401  (register tables on Base.metadata)
from app.db.models import ClauseFinding as ClauseFindingRow
from app.db.models import ContractDraft as ContractDraftRow
from app.db.models import ReviewQueueItem as ReviewQueueItemRow
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
from app.services.contract_reporter import ContractReporter
from app.services.contract_text_extractor import ContractTextExtractor
from app.services.copilot_advisor import CopilotAdvisor, DISCLAIMER as COPILOT_DISCLAIMER
from app.services.custom_reasoning_model import CustomReasoningModel
from app.services.reasoning import (
    FallbackChainProvider,
    KimiProvider,
    RulesBasedProvider,
)

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
_copilot_advisor: CopilotAdvisor | None = None


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
    global _http_client, _async_analysis, _contract_reporter, _copilot_advisor
    timeout = httpx.Timeout(
        connect=5.0,
        read=settings.reasoning_timeout_seconds,
        write=10.0,
        pool=5.0,
    )
    _http_client = httpx.AsyncClient(timeout=timeout)
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
    _copilot_advisor = CopilotAdvisor(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=120.0,
    )


def get_async_analysis() -> AsyncContractAnalysisService:
    _ensure_runtime()
    assert _async_analysis is not None
    return _async_analysis


def get_contract_reporter() -> ContractReporter | None:
    _ensure_runtime()
    return _contract_reporter


def get_copilot_advisor() -> CopilotAdvisor | None:
    _ensure_runtime()
    return _copilot_advisor


def _build_provider_chain(client: "httpx.AsyncClient"):
    rules = RulesBasedProvider(model_name=f"rules-fallback-of-{settings.reasoning_model}")
    if not settings.reasoning_api_key:
        return FallbackChainProvider([rules])

    primary = KimiProvider(
        client=client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        max_retries=settings.reasoning_max_retries,
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
            )
        )
    chain.append(rules)
    return FallbackChainProvider(chain)


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

    global _http_client, _async_analysis, _contract_reporter, _copilot_advisor
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
    _copilot_advisor = CopilotAdvisor(
        client=_http_client,
        api_key=settings.reasoning_api_key,
        model=settings.reasoning_model,
        base_url=settings.reasoning_base_url,
        timeout=120.0,
    )

    try:
        yield
    finally:
        if _http_client is not None:
            await _http_client.aclose()
        _http_client = None
        _async_analysis = None
        _contract_reporter = None
        _copilot_advisor = None
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
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
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


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    request_id = request.headers.get("x-request-id") or uuid4().hex
    set_request_id(request_id)
    started = perf_counter()
    response = None
    try:
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
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": ErrorCode.request_validation_error.value,
                "message": "Request validation failed.",
                "details": {"issues": str(exc.errors())},
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
    dependencies=[Depends(_analyze_limiter)],
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

    try:
        analysis_with_flags = await get_async_analysis().analyze(contract_text, session=session)
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=str(exc),
            status_code=422,
        ) from exc
    analysis = analysis_with_flags.result
    injection_flags = analysis_with_flags.injection_flags
    important_findings = [
        f
        for f in analysis.findings
        if f.clause.clause_type.value != "uncategorized"
        and f.severity.value in {"medium", "high", "critical"}
    ]

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

    report = None
    reporter = get_contract_reporter()
    if reporter is not None:
        try:
            # Hard cap so a slow Kimi call can't 504 the whole upload —
            # frontend still gets the draft + rules-based findings, and
            # the user can re-trigger reasoning later from the Findings tab.
            import asyncio
            report = await asyncio.wait_for(reporter.generate(contract_text), timeout=120.0)
        except asyncio.TimeoutError:
            logger.warning("Reporter timed out after 120s — returning rules-only response.")
            report = None
        except Exception:  # pragma: no cover — never block the response
            logger.exception("Contract report generation failed.")
            report = None

    response = _build_response(
        draft_row, finding_rows, report=report, extracted_text=contract_text
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
    dependencies=[Depends(_analyze_limiter)],
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


@app.post(
    "/analyze/url",
    response_model=AnalyzeContractResponse,
    dependencies=[Depends(_analyze_limiter)],
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
    try:
        resp = await _http_client.get(url, timeout=20.0, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=f"Could not fetch the URL: {exc}",
            status_code=422,
        ) from exc
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
    reply = await advisor.chat(
        template=body.template,
        history=[m.model_dump() for m in body.history],
        message=body.message,
        mode=body.mode,
    )
    return CopilotGuidanceResponse(reply=reply, model=advisor.model)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "AI Contract Risk Analyzer backend scaffold is running.",
        "note": "Week 1 API contracts and backend infra baseline are in place.",
    }

