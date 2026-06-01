"""Comments / Annotations — PRD §4.10."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import (
    CommentCreateRequest,
    CommentListResponse,
    CommentView,
)
from app.db.models import ClauseFinding, Comment, ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

router = APIRouter(prefix="/api/v1/comments", tags=["comments"])


@router.post("", response_model=CommentView)
async def create_comment(
    body: CommentCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> CommentView:
    draft = (
        await session.execute(
            select(ContractDraft).where(
                ContractDraft.id == body.draft_id,
                ContractDraft.owner_id == user.id,
                ContractDraft.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if draft is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )
    finding_row_id: str | None = None
    if body.finding_id:
        finding = (
            await session.execute(
                select(ClauseFinding).where(
                    ClauseFinding.draft_id == draft.id,
                    ClauseFinding.finding_id == body.finding_id,
                )
            )
        ).scalar_one_or_none()
        if finding is None:
            raise AppError(
                code=ErrorCode.request_validation_error,
                message="Finding not found on draft.",
                status_code=404,
            )
        finding_row_id = finding.id
    comment = Comment(
        draft_id=draft.id,
        finding_id=finding_row_id,
        author_id=user.id,
        body=body.body,
    )
    session.add(comment)
    await session.flush()
    await append_audit_event(
        session,
        action="comment.create",
        target_type="contract_draft",
        target_id=draft.id,
        actor_id=user.id,
        payload={"comment_id": comment.id, "finding_id": body.finding_id},
    )
    await session.commit()
    return CommentView(
        id=comment.id,
        draft_id=comment.draft_id,
        finding_id=body.finding_id,
        author_id=comment.author_id,
        body=comment.body,
        created_at=comment.created_at.isoformat(),
    )


@router.get("", response_model=CommentListResponse)
async def list_comments(
    draft_id: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> CommentListResponse:
    # Only the draft owner may read its comments (prevents cross-tenant reads).
    owns = (
        await session.execute(
            select(ContractDraft.id).where(
                ContractDraft.id == draft_id,
                ContractDraft.owner_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if owns is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )
    rows = list(
        (
            await session.execute(
                select(Comment).where(Comment.draft_id == draft_id).order_by(Comment.created_at)
            )
        )
        .scalars()
        .all()
    )
    return CommentListResponse(
        items=[
            CommentView(
                id=c.id,
                draft_id=c.draft_id,
                finding_id=None,
                author_id=c.author_id,
                body=c.body,
                created_at=c.created_at.isoformat(),
            )
            for c in rows
        ]
    )
