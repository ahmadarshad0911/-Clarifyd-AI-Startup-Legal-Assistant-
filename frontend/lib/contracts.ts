export const API_CONTRACT_VERSION = "2026-05-week1-freeze";

export type ProcessingStatus = "queued" | "validating" | "ready_for_processing";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ReviewDecision = "accept" | "request_change" | "escalate";
export type ExportFormat = "pdf" | "json";
export type ExportStatus = "queued" | "ready" | "failed";

export type UploadContractRequest = {
  file_name: string;
  file_size_bytes: number;
};

export type UploadContractResponse = {
  contract_version: string;
  draft_id: string;
  status: ProcessingStatus;
};

export type ClauseFinding = {
  finding_id: string;
  clause_name: string;
  excerpt: string;
  risk_level: RiskLevel;
  risk_score?: number;
  confidence: number;
  explanation: string;
  safer_language?: string | null;
};

export type RiskSummary = {
  overall_score: number;
  highest_risk: RiskLevel;
  findings_count: number;
};

export type ReportLoophole = {
  clause_name: string;
  excerpt: string;
  issue: string;
  severity: RiskLevel;
  impact: string;
};

export type ReportSuggestion = {
  clause_name: string;
  original_excerpt: string;
  suggested_clause: string;
  rationale: string;
};

export type CrossVerification = {
  risks_resolved: boolean;
  residual_concerns: string;
  notes: string;
};

export type ContractAmbiguity = {
  clause_name: string;
  excerpt: string;
  issue: string;
  suggestion?: string;
  severity: RiskLevel;
};

export type ContractReport = {
  model_name: string;
  verdict: RiskLevel;
  executive_summary: string;
  loopholes: ReportLoophole[];
  suggestions: ReportSuggestion[];
  cross_verification: CrossVerification;
};

export type AnalyzeContractResponse = {
  contract_version: string;
  draft_id: string;
  status: ProcessingStatus;
  summary: RiskSummary;
  findings: ClauseFinding[];
  report?: ContractReport | null;
  ambiguities?: ContractAmbiguity[];
  extracted_text?: string | null;
};

export type ReviewActionResponse = {
  contract_version: string;
  draft_id: string;
  finding_id: string;
  decision: ReviewDecision;
  recorded: boolean;
};

export type ExportReportResponse = {
  contract_version: string;
  draft_id: string;
  export_id: string;
  format: ExportFormat;
  status: ExportStatus;
};

export type StructuredApiError = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    request_id: string;
  };
};

export type Role = "admin" | "reviewer" | "viewer";

export type LoginRequest = { email: string; password: string };

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  role: Role;
};

export type Me = { id: string; email: string; role: Role };

// --- legal co-pilot ---

export type CopilotMessage = { role: "user" | "assistant"; content: string };
export type CopilotMode = "template" | "custom" | "chat";

export type CopilotGuidanceResponse = {
  reply: string;
  model: string;
  not_legal_advice: boolean;
  disclaimer: string;
};

export type ReviewQueueState = "pending" | "in_review" | "resolved";

export type ReviewQueueItem = {
  id: string;
  draft_id: string;
  finding_id: string;
  state: ReviewQueueState;
  assignee_id: string | null;
  opened_at: string;
  closed_at: string | null;
  risk_level: RiskLevel;
  confidence: number;
  clause_name: string;
  excerpt?: string;
  explanation?: string;
  safer_language?: string | null;
  finding_label?: string;
  document_name?: string;
};

export type ReviewListResponse = {
  contract_version: string;
  items: ReviewQueueItem[];
};

export type DecideResponse = {
  contract_version: string;
  item_id: string;
  draft_id: string;
  finding_id: string;
  decision: ReviewDecision;
  recorded: boolean;
  not_legal_advice: boolean;
};

export type ExportStatusResponse = {
  contract_version: string;
  export_id: string;
  draft_id: string;
  format: ExportFormat;
  status: ExportStatus;
  file_path: string | null;
  error_message: string | null;
};

export type AuditVerifyResponse = {
  intact: boolean;
  first_break_id: number | null;
};

// --- Reasoning (PRD §4.12) -----------------------------------------------------

export type StartupProfile = {
  stage?: string | null;
  jurisdiction_hint?: string | null;
  sector?: string | null;
};

export type FounderGuidance = {
  plain_english: string;
  why_it_matters: string;
  suggested_language?: string | null;
  negotiation_points: string[];
  market_standard_reference?: string | null;
};

export type ReasoningFinding = {
  finding_id: string;
  clause_name: string;
  categories: string[];
  excerpt: string;
  risk_score: number; // 1-100
  risk_level: RiskLevel;
  confidence: number; // 0-1
  rationale: string;
  founder_guidance: FounderGuidance;
  injection_suspected: boolean;
};

export type ReasoningEvaluateResponse = {
  contract_version: string;
  draft_id: string;
  model: string;
  not_legal_advice: true;
  disclaimer: string;
  overall_risk_score: number; // 1-100
  overall_risk_level: RiskLevel;
  findings: ReasoningFinding[];
};

export type ReasoningGuidanceResponse = {
  contract_version: string;
  draft_id: string;
  finding_id?: string | null;
  not_legal_advice: true;
  disclaimer: string;
  answer: string;
  refused: boolean;
  refusal_reason?: string | null;
};

// --- Compliance (§4.4) ---------------------------------------------------------

export type ComplianceFlag = {
  finding_id: string;
  clause_name: string;
  rule: string;
  severity: RiskLevel;
  rationale: string;
};

export type ComplianceCheckResponse = {
  contract_version: string;
  draft_id: string;
  jurisdiction: string;
  not_legal_advice: true;
  disclaimer: string;
  compliant: boolean;
  flags: ComplianceFlag[];
};

// --- Simplify (§4.5) -----------------------------------------------------------

export type SimplifiedClause = {
  finding_id: string;
  clause_name: string;
  plain_english: string;
  key_terms: string[];
};

export type SimplifyResponse = {
  contract_version: string;
  draft_id: string;
  not_legal_advice: true;
  disclaimer: string;
  clauses: SimplifiedClause[];
};

// --- Negotiate (§4.6) ----------------------------------------------------------

export type NegotiationSuggestion = {
  finding_id: string;
  clause_name: string;
  risk_level: RiskLevel;
  counter_language: string;
  rationale: string;
  fallback_position?: string | null;
};

export type NegotiateResponse = {
  contract_version: string;
  draft_id: string;
  not_legal_advice: true;
  disclaimer: string;
  suggestions: NegotiationSuggestion[];
};

// --- Compare (§4.7) ------------------------------------------------------------

export type ClauseVariance = {
  clause_name: string;
  present_in: string[];
  risk_levels: Record<string, RiskLevel>;
};

export type CompareResponse = {
  contract_version: string;
  draft_ids: string[];
  variances: ClauseVariance[];
};

// --- Search (§4.9) -------------------------------------------------------------

export type SearchHit = {
  draft_id: string;
  finding_id?: string | null;
  clause_name: string;
  excerpt: string;
  risk_level: RiskLevel;
};

export type SearchResponse = {
  contract_version: string;
  query: string;
  hits: SearchHit[];
};

// --- Comments (§4.10) ----------------------------------------------------------

export type CommentView = {
  id: string;
  draft_id: string;
  finding_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
};

export type CommentListResponse = {
  contract_version: string;
  items: CommentView[];
};

// --- Workflow (§4.8) -----------------------------------------------------------

export type WorkflowAssignResponse = {
  contract_version: string;
  item_id: string;
  assignee_id: string;
  state: string;
};

// --- Webhooks (§4.11) ----------------------------------------------------------

export type WebhookView = {
  id: string;
  url: string;
  event: string;
  created_at: string;
};

export type WebhookListResponse = {
  contract_version: string;
  items: WebhookView[];
};
