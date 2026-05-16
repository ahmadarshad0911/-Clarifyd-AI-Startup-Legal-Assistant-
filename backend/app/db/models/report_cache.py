from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, PrimaryKeyConstraint, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReportCache(Base):
    """Per-(provider, model, prompt_version, contract-sha256) cached full-contract
    ContractReporter payload.

    Sibling of ClauseCache. ClauseCache stores per-clause assessments; this stores
    the full-contract reporter output (verdict + executive_summary + loopholes +
    suggestions + cross_verification). Hit rate matters for two reasons:

      1. Persistence: same contract bytes → identical report JSON → identical UI.
         LLM sampling variance and JSON array re-ordering can't drift the output
         after the first run.
      2. Cost: re-renders of the Findings tab / re-uploads of the same DOCX cost
         zero NIM tokens after the first analysis.

    Invalidation happens by bumping REPORT_PROMPT_VERSION inside
    contract_reporter.py — old rows simply stop matching the new key.
    """

    __tablename__ = "report_cache"
    __table_args__ = (
        PrimaryKeyConstraint(
            "provider",
            "model",
            "prompt_version",
            "contract_sha256",
            name="pk_report_cache",
        ),
    )

    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    contract_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    body_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
