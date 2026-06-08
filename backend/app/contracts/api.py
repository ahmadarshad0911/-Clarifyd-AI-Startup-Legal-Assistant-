from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.contract import ProcessingStatus

API_CONTRACT_VERSION = "2026-05-week1-freeze"


class APIContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class UploadContractRequest(APIContractModel):
    file_name: str = Field(min_length=1)
    file_size_bytes: int = Field(ge=1)


class UploadContractResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    status: ProcessingStatus


class AnalyzeContractRequest(APIContractModel):
    draft_id: str = Field(min_length=1)


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ClauseFinding(APIContractModel):
    finding_id: str
    clause_name: str
    excerpt: str
    risk_level: RiskLevel
    risk_score: int = Field(ge=1, le=100, default=1)
    confidence: float = Field(ge=0, le=1)
    explanation: str
    safer_language: str | None = None


class RiskSummary(APIContractModel):
    overall_score: int = Field(ge=1, le=100)
    highest_risk: RiskLevel
    findings_count: int = Field(ge=0)


class ReportLoophole(APIContractModel):
    clause_name: str
    excerpt: str
    issue: str
    severity: RiskLevel
    impact: str


class ReportSuggestion(APIContractModel):
    clause_name: str
    original_excerpt: str
    suggested_clause: str
    rationale: str


class ContractAmbiguity(APIContractModel):
    clause_name: str
    excerpt: str
    # What is left undefined / open to interpretation, and why it matters.
    issue: str
    severity: RiskLevel
    # A concrete line/sentence the founder can add to cure the ambiguity.
    # Additive, defaulted for backward compatibility with cached analyses.
    suggestion: str = ""


class CrossVerification(APIContractModel):
    risks_resolved: bool
    residual_concerns: str
    notes: str


class ContractReport(APIContractModel):
    model_name: str
    verdict: RiskLevel
    executive_summary: str
    loopholes: list[ReportLoophole]
    suggestions: list[ReportSuggestion]
    cross_verification: CrossVerification


class AnalyzeContractResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    status: ProcessingStatus
    summary: RiskSummary
    findings: list[ClauseFinding]
    report: ContractReport | None = None
    # Parts of the contract that are vague / undefined / open to interpretation.
    # Additive field (default []), surfaced in a dedicated Findings section.
    ambiguities: list[ContractAmbiguity] = []
    # True while the slow enrichment (loopholes, ambiguities, deep report) is
    # still running. The fast response returns per-clause findings immediately
    # with this True; the client calls POST /analyze/{draft_id}/enrich to fill
    # in the rest, after which a re-fetch returns it False. Additive default.
    analysis_pending: bool = False
    # Full extracted contract text — used by the Findings page to splice in
    # accepted suggestions while keeping the rest of the document verbatim.
    extracted_text: str | None = None


class ReviewDecision(str, Enum):
    accept = "accept"
    request_change = "request_change"
    escalate = "escalate"


class ReviewActionRequest(APIContractModel):
    draft_id: str = Field(min_length=1)
    finding_id: str = Field(min_length=1)
    decision: ReviewDecision
    reviewer_note: str | None = None


class ReviewActionResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    finding_id: str
    decision: ReviewDecision
    recorded: bool


class ExportReportRequest(APIContractModel):
    draft_id: str = Field(min_length=1)
    format: Literal["pdf", "json"]


class ExportStatus(str, Enum):
    queued = "queued"
    ready = "ready"
    failed = "failed"


class ExportReportResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    export_id: str
    format: Literal["pdf", "json"]
    status: ExportStatus


# --- Reasoning Model API (PRD §4.12) -------------------------------------------------

REASONING_DISCLAIMER = (
    "Decision-support only. Not a substitute for licensed counsel."
)

CLAUSE_CATEGORIES: tuple[str, ...] = (
    "termination",
    "liability",
    "indemnification",
    "limitation_of_liability",
    "payment_terms",
    "intellectual_property",
    "confidentiality",
    "data_protection",
    "dispute_resolution",
    "force_majeure",
    "amendment_renewal",
    "warranties",
    "insurance",
    "governing_law",
    "general",
)


class StartupProfile(APIContractModel):
    stage: str | None = None
    jurisdiction_hint: str | None = None
    sector: str | None = None


class FounderGuidance(APIContractModel):
    plain_english: str = Field(min_length=1)
    why_it_matters: str = Field(min_length=1)
    suggested_language: str | None = None
    negotiation_points: list[str] = Field(default_factory=list)
    market_standard_reference: str | None = None


class ReasoningFinding(APIContractModel):
    finding_id: str
    clause_name: str
    categories: list[str] = Field(min_length=1)
    excerpt: str
    risk_score: int = Field(ge=1, le=100)
    risk_level: RiskLevel
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str
    founder_guidance: FounderGuidance
    injection_suspected: bool = False


class ReasoningEvaluateRequest(APIContractModel):
    draft_id: str | None = Field(default=None, min_length=1)
    raw_text: str | None = Field(default=None, min_length=1)
    startup_profile: StartupProfile | None = None


class ReasoningEvaluateResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    model: str
    not_legal_advice: Literal[True] = True
    disclaimer: str = REASONING_DISCLAIMER
    overall_risk_score: int = Field(ge=1, le=100)
    overall_risk_level: RiskLevel
    findings: list[ReasoningFinding]


class ReasoningGuidanceRequest(APIContractModel):
    draft_id: str = Field(min_length=1)
    finding_id: str | None = None
    question: str = Field(min_length=1, max_length=2000)
    startup_profile: StartupProfile | None = None


class ReasoningGuidanceResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    finding_id: str | None = None
    not_legal_advice: Literal[True] = True
    disclaimer: str = REASONING_DISCLAIMER
    answer: str
    refused: bool = False
    refusal_reason: str | None = None


class ReasoningCategoriesResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    categories: list[str]


class ReasoningJobStatus(str, Enum):
    queued = "queued"
    running = "running"
    ready = "ready"
    failed = "failed"


class ReasoningJobResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    job_id: str
    status: ReasoningJobStatus
    draft_id: str | None = None
    result: ReasoningEvaluateResponse | None = None
    error: str | None = None


# --- Compliance (PRD §4.4) -----------------------------------------------------------

JURISDICTIONS: tuple[str, ...] = ("US", "UK", "EU", "APAC", "GLOBAL")


class ComplianceFlag(APIContractModel):
    finding_id: str
    clause_name: str
    rule: str
    severity: RiskLevel
    rationale: str


class ComplianceCheckRequest(APIContractModel):
    draft_id: str = Field(min_length=1)
    jurisdiction: str = "GLOBAL"
    regulations: list[str] = Field(default_factory=list)


class ComplianceCheckResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    jurisdiction: str
    not_legal_advice: Literal[True] = True
    disclaimer: str = REASONING_DISCLAIMER
    compliant: bool
    flags: list[ComplianceFlag]


# --- Simplification (PRD §4.5) -------------------------------------------------------

class SimplifiedClause(APIContractModel):
    finding_id: str
    clause_name: str
    plain_english: str
    key_terms: list[str] = Field(default_factory=list)


class SimplifyResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    not_legal_advice: Literal[True] = True
    disclaimer: str = REASONING_DISCLAIMER
    clauses: list[SimplifiedClause]


# --- Negotiation (PRD §4.6) ----------------------------------------------------------

class NegotiationSuggestion(APIContractModel):
    finding_id: str
    clause_name: str
    risk_level: RiskLevel
    counter_language: str
    rationale: str
    fallback_position: str | None = None


class NegotiateRequest(APIContractModel):
    draft_id: str = Field(min_length=1)
    finding_ids: list[str] = Field(default_factory=list)


class NegotiateResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_id: str
    not_legal_advice: Literal[True] = True
    disclaimer: str = REASONING_DISCLAIMER
    suggestions: list[NegotiationSuggestion]


# --- Comparison & Benchmarking (PRD §4.7) --------------------------------------------

class ClauseVariance(APIContractModel):
    clause_name: str
    present_in: list[str]
    risk_levels: dict[str, RiskLevel]


class CompareRequest(APIContractModel):
    draft_ids: list[str] = Field(min_length=2)


class CompareResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    draft_ids: list[str]
    variances: list[ClauseVariance]


# --- Search (PRD §4.9) ---------------------------------------------------------------

class SearchHit(APIContractModel):
    draft_id: str
    finding_id: str | None = None
    clause_name: str
    excerpt: str
    risk_level: RiskLevel


class SearchResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    query: str
    hits: list[SearchHit]


# --- Comments (PRD §4.10) ------------------------------------------------------------

class CommentCreateRequest(APIContractModel):
    draft_id: str = Field(min_length=1)
    finding_id: str | None = None
    body: str = Field(min_length=1, max_length=4000)


class CommentView(APIContractModel):
    id: str
    draft_id: str
    finding_id: str | None
    author_id: str
    body: str
    created_at: str


class CommentListResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    items: list[CommentView]


# --- Workflow assignment (PRD §4.8) --------------------------------------------------

class WorkflowAssignRequest(APIContractModel):
    item_id: str = Field(min_length=1)
    assignee_id: str = Field(min_length=1)


class WorkflowAssignResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    item_id: str
    assignee_id: str
    state: str


# --- Integrations / Webhooks (PRD §4.11) ---------------------------------------------

class WebhookCreateRequest(APIContractModel):
    url: str = Field(min_length=8, max_length=2048)
    event: str = Field(min_length=1, max_length=64)
    secret: str | None = Field(default=None, max_length=128)


class WebhookView(APIContractModel):
    id: str
    url: str
    event: str
    created_at: str


class WebhookListResponse(APIContractModel):
    contract_version: str = API_CONTRACT_VERSION
    items: list[WebhookView]
