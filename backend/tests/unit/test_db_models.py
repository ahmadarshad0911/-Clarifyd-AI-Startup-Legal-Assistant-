from __future__ import annotations

import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import (
    AuditEvent,
    ClauseFinding,
    ContractDraft,
    ExportJob,
    ReviewAction,
    ReviewQueueItem,
)
from app.db.models.audit_event import GENESIS_HASH


@pytest.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    async with sessionmaker() as s:
        yield s
    await engine.dispose()


@pytest.mark.asyncio
async def test_contract_draft_roundtrip(session: AsyncSession) -> None:
    draft = ContractDraft(
        file_name="contract.pdf",
        file_size_bytes=2048,
        sha256="a" * 64,
        mime="application/pdf",
        status="ready_for_processing",
    )
    session.add(draft)
    await session.commit()
    fetched = (await session.execute(select(ContractDraft))).scalar_one()
    assert fetched.file_name == "contract.pdf"
    assert fetched.sha256 == "a" * 64
    assert fetched.uploaded_at is not None
    assert fetched.deleted_at is None


@pytest.mark.asyncio
async def test_clause_finding_fk(session: AsyncSession) -> None:
    draft = ContractDraft(file_name="c.pdf", file_size_bytes=10, sha256="b" * 64)
    session.add(draft)
    await session.flush()
    finding = ClauseFinding(
        draft_id=draft.id,
        finding_id="finding-1",
        clause_name="liability",
        excerpt="unlimited liability...",
        risk_level="critical",
        risk_score=10,
        confidence=0.9,
        explanation="risk explanation",
    )
    session.add(finding)
    await session.commit()
    fetched = (await session.execute(select(ClauseFinding))).scalar_one()
    assert fetched.draft_id == draft.id
    assert fetched.injection_suspected is False


@pytest.mark.asyncio
async def test_review_action_and_queue_roundtrip(session: AsyncSession) -> None:
    draft = ContractDraft(file_name="c.pdf", file_size_bytes=1, sha256="c" * 64)
    session.add(draft)
    await session.flush()
    finding = ClauseFinding(
        draft_id=draft.id,
        finding_id="f1",
        clause_name="termination",
        excerpt="t",
        risk_level="high",
    )
    session.add(finding)
    await session.flush()

    queue_item = ReviewQueueItem(draft_id=draft.id, finding_id=finding.id)
    action = ReviewAction(
        draft_id=draft.id, finding_id=finding.id, decision="accept", reviewer_note="ok"
    )
    session.add_all([queue_item, action])
    await session.commit()

    qi = (await session.execute(select(ReviewQueueItem))).scalar_one()
    ra = (await session.execute(select(ReviewAction))).scalar_one()
    assert qi.state == "pending"
    assert ra.decision == "accept"


@pytest.mark.asyncio
async def test_export_job_roundtrip(session: AsyncSession) -> None:
    draft = ContractDraft(file_name="c.pdf", file_size_bytes=1, sha256="d" * 64)
    session.add(draft)
    await session.flush()
    job = ExportJob(draft_id=draft.id, format="json")
    session.add(job)
    await session.commit()
    fetched = (await session.execute(select(ExportJob))).scalar_one()
    assert fetched.status == "queued"
    assert fetched.format == "json"


@pytest.mark.asyncio
async def test_audit_event_hash_chain(session: AsyncSession) -> None:
    e1 = AuditEvent(
        actor_id="user-1",
        action="upload",
        target_type="contract_draft",
        target_id="draft-1",
        request_id="req-1",
        payload_json=json.dumps({"file_name": "a.pdf"}),
        prev_hash=GENESIS_HASH,
    )
    e1.hash = e1.compute_hash()
    session.add(e1)
    await session.commit()

    e2 = AuditEvent(
        actor_id="user-1",
        action="analyze",
        target_type="contract_draft",
        target_id="draft-1",
        request_id="req-2",
        payload_json=json.dumps({"findings": 3}),
        prev_hash=e1.hash,
    )
    e2.hash = e2.compute_hash()
    session.add(e2)
    await session.commit()

    rows = (await session.execute(select(AuditEvent).order_by(AuditEvent.id))).scalars().all()
    assert len(rows) == 2
    assert rows[0].prev_hash == GENESIS_HASH
    assert rows[1].prev_hash == rows[0].hash
    # Recompute and verify chain integrity.
    assert rows[0].compute_hash() == rows[0].hash
    assert rows[1].compute_hash() == rows[1].hash


@pytest.mark.asyncio
async def test_audit_hash_detects_tamper(session: AsyncSession) -> None:
    e = AuditEvent(
        actor_id="u",
        action="upload",
        target_type="contract_draft",
        target_id="d",
        payload_json="{}",
        prev_hash=GENESIS_HASH,
    )
    e.hash = e.compute_hash()
    original_hash = e.hash
    e.payload_json = '{"tampered": true}'
    assert e.compute_hash() != original_hash
