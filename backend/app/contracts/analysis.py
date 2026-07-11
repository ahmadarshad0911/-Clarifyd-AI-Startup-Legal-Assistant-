from enum import Enum
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field


class ClauseType(str, Enum):
    liability = "liability"
    indemnity = "indemnity"
    payment_terms = "payment_terms"
    termination = "termination"
    confidentiality = "confidentiality"
    ip_ownership = "ip_ownership"
    governing_law = "governing_law"
    dispute_resolution = "dispute_resolution"
    data_protection = "data_protection"
    assignment = "assignment"
    uncategorized = "uncategorized"


class RiskSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AnalysisContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ExtractedClause(AnalysisContractModel):
    clause_id: str = Field(min_length=1)
    clause_type: ClauseType
    text: str = Field(min_length=1)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=0)
    confidence: float = Field(ge=0, le=1)


class ClauseRiskFinding(AnalysisContractModel):
    clause: ExtractedClause
    severity: RiskSeverity
    risk_score: int = Field(ge=1, le=10)
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(min_length=1)


class AnalysisSummary(AnalysisContractModel):
    overall_score: int = Field(ge=1, le=10)
    highest_severity: RiskSeverity
    findings_count: int = Field(ge=0)


class ContractAnalysisResult(AnalysisContractModel):
    clauses: list[ExtractedClause]
    findings: list[ClauseRiskFinding]
    summary: AnalysisSummary


class ContractAnalysisProtocol(Protocol):
    def extract_clauses(self, contract_text: str) -> list[ExtractedClause]: ...

    def score_risks(self, clauses: list[ExtractedClause]) -> list[ClauseRiskFinding]: ...

    def analyze_text(self, contract_text: str) -> ContractAnalysisResult: ...


class CustomReasoningModelProtocol(Protocol):
    def assess_clause(self, clause: ExtractedClause) -> ClauseRiskFinding: ...

    def summarize(self, findings: list[ClauseRiskFinding]) -> AnalysisSummary: ...
