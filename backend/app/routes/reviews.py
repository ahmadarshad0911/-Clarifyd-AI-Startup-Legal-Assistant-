from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import (
    API_CONTRACT_VERSION,
    ReviewActionRequest,
    ReviewDecision,
)
from app.db.models import (
    ClauseFinding,
    ContractDraft,
    ReviewAction,
    ReviewQueueItem,
)
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

router = APIRouter(prefix="/reviews", tags=["reviews"])

PENDING = "pending"
IN_REVIEW = "in_review"
RESOLVED = "resolved"


class ReviewQueueItemView(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    draft_id: str
    finding_id: str
    state: Literal["pending", "in_review", "resolved"]
    assignee_id: str | None
    opened_at: datetime
    closed_at: datetime | None
    risk_level: str
    confidence: float
    clause_name: str
    excerpt: str = ""
    explanation: str = ""
    safer_language: str | None = None
    finding_label: str = ""
    document_name: str = ""


class ReviewListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: str = API_CONTRACT_VERSION
    items: list[ReviewQueueItemView]


class ClaimResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_id: str
    state: Literal["in_review"]
    assignee_id: str


class DecideResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: str = API_CONTRACT_VERSION
    item_id: str
    draft_id: str
    finding_id: str
    decision: ReviewDecision
    recorded: bool
    not_legal_advice: bool = True


@router.get("", response_model=ReviewListResponse)
async def list_reviews(
    state: Literal["pending", "in_review", "resolved"] | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> ReviewListResponse:
    stmt = (
        select(ReviewQueueItem, ClauseFinding, ContractDraft)
        .join(ClauseFinding, ReviewQueueItem.finding_id == ClauseFinding.id)
        .join(ContractDraft, ReviewQueueItem.draft_id == ContractDraft.id)
        .where(ContractDraft.owner_id == user.id)
        .where(ContractDraft.deleted_at.is_(None))
        .order_by(ReviewQueueItem.opened_at)
    )
    if state is not None:
        stmt = stmt.where(ReviewQueueItem.state == state)
    rows = (await session.execute(stmt)).all()
    return ReviewListResponse(
        items=[
            ReviewQueueItemView(
                id=item.id,
                draft_id=item.draft_id,
                finding_id=item.finding_id,
                state=item.state,  # type: ignore[arg-type]
                assignee_id=item.assignee_id,
                opened_at=item.opened_at,
                closed_at=item.closed_at,
                risk_level=finding.risk_level,
                confidence=finding.confidence,
                clause_name=finding.clause_name,
                excerpt=getattr(finding, "excerpt", "") or "",
                explanation=getattr(finding, "explanation", "") or "",
                safer_language=getattr(finding, "safer_language", None),
                finding_label=getattr(finding, "finding_id", "") or "",
                document_name=getattr(draft, "file_name", "") or "",
            )
            for item, finding, draft in rows
        ]
    )


async def _load_item(session: AsyncSession, item_id: str) -> ReviewQueueItem:
    item = (
        await session.execute(
            select(ReviewQueueItem).where(ReviewQueueItem.id == item_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Review item not found.",
            status_code=404,
        )
    return item


@router.post("/{item_id}/claim", response_model=ClaimResponse)
async def claim_review(
    item_id: str,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> ClaimResponse:
    # Race-safe transition: only update when still pending and unassigned.
    result = await session.execute(
        update(ReviewQueueItem)
        .where(
            ReviewQueueItem.id == item_id,
            ReviewQueueItem.state == PENDING,
            ReviewQueueItem.assignee_id.is_(None),
        )
        .values(state=IN_REVIEW, assignee_id=user.id)
    )
    if result.rowcount != 1:
        # Either missing or already claimed.
        existing = await _load_item(session, item_id)
        raise AppError(
            code=ErrorCode.policy_violation,
            message=f"Review item already in state '{existing.state}'.",
            status_code=409,
        )
    item = await _load_item(session, item_id)
    await append_audit_event(
        session,
        action="review.claim",
        target_type="review_queue_item",
        target_id=item.id,
        actor_id=user.id,
        payload={"finding_id": item.finding_id, "draft_id": item.draft_id},
    )
    await session.commit()
    return ClaimResponse(item_id=item.id, state="in_review", assignee_id=user.id)


@router.post("/{item_id}/decide", response_model=DecideResponse)
async def decide_review(
    item_id: str,
    body: ReviewActionRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> DecideResponse:
    item = await _load_item(session, item_id)
    if item.state == RESOLVED:
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Review item already resolved.",
            status_code=409,
        )
    if item.draft_id != body.draft_id or item.finding_id != body.finding_id:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Body draft_id/finding_id do not match queue item.",
            status_code=422,
        )
    # Permit decide either after claim (assignee == user) or directly from pending.
    if item.assignee_id is not None and item.assignee_id != user.id:
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Item assigned to another reviewer.",
            status_code=403,
        )

    action = ReviewAction(
        draft_id=item.draft_id,
        finding_id=item.finding_id,
        decision=body.decision.value,
        reviewer_id=user.id,
        reviewer_note=body.reviewer_note,
    )
    session.add(action)

    item.state = RESOLVED
    item.closed_at = datetime.now(timezone.utc)
    if item.assignee_id is None:
        item.assignee_id = user.id

    await append_audit_event(
        session,
        action="review.decide",
        target_type="review_queue_item",
        target_id=item.id,
        actor_id=user.id,
        payload={
            "decision": body.decision.value,
            "draft_id": item.draft_id,
            "finding_id": item.finding_id,
        },
    )
    await session.commit()
    return DecideResponse(
        item_id=item.id,
        draft_id=item.draft_id,
        finding_id=item.finding_id,
        decision=body.decision,
        recorded=True,
    )
