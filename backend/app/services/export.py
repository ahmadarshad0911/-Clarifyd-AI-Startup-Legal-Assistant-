from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_sessionmaker
from app.db.models import (
    AuditEvent,
    ClauseFinding,
    ContractDraft,
    ExportJob,
    ReviewAction,
)
from app.services.audit import verify_audit_chain

logger = logging.getLogger(__name__)

try:  # PDF support is optional; ship JSON if reportlab is unavailable.
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    _PDF_AVAILABLE = True
except Exception:  # pragma: no cover
    _PDF_AVAILABLE = False


def is_pdf_supported() -> bool:
    return _PDF_AVAILABLE


async def _gather_payload(session: AsyncSession, draft_id: str) -> dict[str, Any]:
    draft = (
        await session.execute(select(ContractDraft).where(ContractDraft.id == draft_id))
    ).scalar_one_or_none()
    if draft is None:
        raise ValueError(f"Draft {draft_id} not found.")

    findings = (
        (
            await session.execute(
                select(ClauseFinding).where(ClauseFinding.draft_id == draft_id)
            )
        )
        .scalars()
        .all()
    )
    actions = (
        (
            await session.execute(
                select(ReviewAction).where(ReviewAction.draft_id == draft_id)
            )
        )
        .scalars()
        .all()
    )
    audit_rows = (
        (
            await session.execute(
                select(AuditEvent)
                .where(AuditEvent.target_id == draft_id)
                .order_by(AuditEvent.id)
            )
        )
        .scalars()
        .all()
    )
    chain_break = await verify_audit_chain(session)

    return {
        "draft": {
            "id": draft.id,
            "file_name": draft.file_name,
            "file_size_bytes": draft.file_size_bytes,
            "sha256": draft.sha256,
            "mime": draft.mime,
            "status": draft.status,
            "owner_id": draft.owner_id,
            "uploaded_at": draft.uploaded_at.isoformat() if draft.uploaded_at else None,
            "deleted_at": draft.deleted_at.isoformat() if draft.deleted_at else None,
        },
        "findings": [
            {
                "finding_id": f.finding_id,
                "clause_name": f.clause_name,
                "excerpt": f.excerpt,
                "risk_level": f.risk_level,
                "risk_score": f.risk_score,
                "confidence": f.confidence,
                "explanation": f.explanation,
                "injection_suspected": f.injection_suspected,
            }
            for f in findings
        ],
        "review_actions": [
            {
                "decision": a.decision,
                "reviewer_id": a.reviewer_id,
                "reviewer_note": a.reviewer_note,
                "finding_id": a.finding_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in actions
        ],
        "audit_trail": [
            {
                "event_id": e.event_id,
                "ts": e.ts.isoformat() if e.ts else None,
                "actor_id": e.actor_id,
                "action": e.action,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "request_id": e.request_id,
                "payload": json.loads(e.payload_json or "{}"),
                "prev_hash": e.prev_hash,
                "hash": e.hash,
            }
            for e in audit_rows
        ],
        "audit_chain_intact": chain_break is None,
        "audit_chain_break_at": chain_break,
        "not_legal_advice": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _render_pdf(payload: dict[str, Any], target: Path) -> None:
    if not _PDF_AVAILABLE:
        raise RuntimeError("PDF generation is disabled (reportlab not installed).")
    target.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(target), pagesize=LETTER, title="Clarifyd Export")

    story: list[Any] = []
    story.append(Paragraph("Clarifyd Contract Risk Report", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            "Decision-support only — this report is <b>not legal advice</b>.",
            styles["Italic"],
        )
    )
    story.append(Spacer(1, 12))

    draft = payload["draft"]
    story.append(Paragraph(f"Draft: {draft['file_name']} (id {draft['id']})", styles["Heading2"]))
    story.append(
        Paragraph(
            f"Uploaded: {draft.get('uploaded_at')} &middot; Owner: {draft.get('owner_id')}"
            f" &middot; SHA-256: {draft.get('sha256')[:12]}…",
            styles["BodyText"],
        )
    )
    story.append(Spacer(1, 12))

    findings = payload["findings"]
    story.append(Paragraph(f"Findings ({len(findings)})", styles["Heading2"]))
    table_rows = [["#", "Clause", "Risk", "Score", "Conf.", "Explanation"]]
    for idx, f in enumerate(findings, start=1):
        table_rows.append(
            [
                str(idx),
                f["clause_name"],
                f["risk_level"],
                str(f["risk_score"]),
                f"{f['confidence']:.2f}",
                (f["explanation"][:120] + "…") if len(f["explanation"]) > 120 else f["explanation"],
            ]
        )
    tbl = Table(table_rows, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a365d")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 18))

    actions = payload["review_actions"]
    story.append(Paragraph(f"Review Decisions ({len(actions)})", styles["Heading2"]))
    if actions:
        action_rows = [["Finding", "Decision", "Reviewer", "Note"]]
        for a in actions:
            action_rows.append(
                [
                    a["finding_id"],
                    a["decision"],
                    a["reviewer_id"] or "",
                    (a.get("reviewer_note") or "")[:80],
                ]
            )
        story.append(Table(action_rows, repeatRows=1, hAlign="LEFT"))
    else:
        story.append(Paragraph("No review decisions recorded.", styles["BodyText"]))
    story.append(Spacer(1, 18))

    chain_text = (
        "Audit chain integrity: <b>VERIFIED</b>"
        if payload.get("audit_chain_intact")
        else f"Audit chain integrity: <b>BROKEN at id={payload.get('audit_chain_break_at')}</b>"
    )
    story.append(Paragraph(chain_text, styles["BodyText"]))

    doc.build(story)


async def render_export(
    *, export_id: str, draft_id: str, fmt: str, target_dir: Path
) -> tuple[Path, str | None]:
    """Generate the export file. Returns (path, error_message_or_none)."""
    target_dir.mkdir(parents=True, exist_ok=True)
    sm = get_sessionmaker()
    async with sm() as session:
        try:
            payload = await _gather_payload(session, draft_id)
        except ValueError as exc:
            return target_dir / f"{export_id}.error", str(exc)

    if fmt == "json":
        path = target_dir / f"{export_id}.json"
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return path, None
    if fmt == "pdf":
        if not _PDF_AVAILABLE:
            return target_dir / f"{export_id}.error", "PDF generation is disabled on this server."
        path = target_dir / f"{export_id}.pdf"
        try:
            _render_pdf(payload, path)
        except Exception as exc:  # pragma: no cover
            logger.exception("PDF render failed")
            return path, f"PDF render failed: {exc}"
        return path, None
    return target_dir / f"{export_id}.error", f"Unknown format '{fmt}'"


async def finalize_export_job(
    *, export_id: str, draft_id: str, fmt: str, target_dir: Path
) -> None:
    """Background task entry: regenerate file and update ExportJob row."""
    sm = get_sessionmaker()
    path, err = await render_export(
        export_id=export_id, draft_id=draft_id, fmt=fmt, target_dir=target_dir
    )
    async with sm() as session:
        job = (
            await session.execute(select(ExportJob).where(ExportJob.id == export_id))
        ).scalar_one_or_none()
        if job is None:  # pragma: no cover
            return
        if err is not None:
            job.status = "failed"
            job.error_message = err[:512]
        else:
            job.status = "ready"
            job.file_path = str(path)
            job.completed_at = datetime.now(timezone.utc)
        await session.commit()
