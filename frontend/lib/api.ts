import type {
  AnalyzeContractResponse,
  AuditVerifyResponse,
  CommentListResponse,
  CommentView,
  CompareResponse,
  ComplianceCheckResponse,
  CopilotGuidanceResponse,
  CopilotMessage,
  CopilotMode,
  DecideResponse,
  ExportFormat,
  ExportReportResponse,
  ExportStatusResponse,
  LoginRequest,
  LoginResponse,
  Me,
  NegotiateResponse,
  ReasoningEvaluateResponse,
  ReasoningGuidanceResponse,
  ReviewDecision,
  ReviewListResponse,
  ReviewQueueState,
  SearchResponse,
  SimplifyResponse,
  StartupProfile,
  StructuredApiError,
  WebhookListResponse,
  WebhookView,
  WorkflowAssignResponse,
} from "./contracts";

const DEFAULT_BASE_URL = "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  requestId: string;

  constructor(status: number, body: StructuredApiError | { detail?: unknown } | unknown) {
    const envelope = (body as StructuredApiError)?.error;
    const message = envelope?.message ?? `Request failed with status ${status}`;
    super(message);
    this.status = status;
    this.code = envelope?.code ?? "unknown_error";
    this.details = envelope?.details ?? {};
    this.requestId = envelope?.request_id ?? "";
  }
}

export type TokenProvider = () => string | null;

export class ApiClient {
  baseUrl: string;
  private getToken: TokenProvider;

  constructor(getToken: TokenProvider, baseUrl?: string) {
    this.baseUrl =
      baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE_URL;
    this.getToken = getToken;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    const h: Record<string, string> = {
      Accept: "application/json",
      ...((extra as Record<string, string> | undefined) ?? {}),
    };
    const token = this.getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: this.headers(init.headers),
    });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // ignore — non-json error body
      }
      throw new ApiError(res.status, body);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  // --- auth ---

  async login(body: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async register(body: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async me(): Promise<Me> {
    return this.request<Me>("/auth/me");
  }

  // --- legal co-pilot ---

  async copilotGuidance(
    template: string,
    message: string,
    history: CopilotMessage[] = [],
    mode: CopilotMode = "template"
  ): Promise<CopilotGuidanceResponse> {
    return this.request<CopilotGuidanceResponse>("/api/v1/copilot/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, message, history, mode }),
    });
  }

  // --- analyze ---

  async analyzeContract(file: File): Promise<AnalyzeContractResponse> {
    const form = new FormData();
    form.append("file", file);
    return this.request<AnalyzeContractResponse>("/analyze/contract", {
      method: "POST",
      body: form,
    });
  }

  async analyzeText(text: string, sourceName?: string): Promise<AnalyzeContractResponse> {
    return this.request<AnalyzeContractResponse>("/analyze/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_name: sourceName ?? "Pasted contract" }),
    });
  }

  async analyzeUrl(url: string): Promise<AnalyzeContractResponse> {
    return this.request<AnalyzeContractResponse>("/analyze/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  }

  // --- reviews ---

  async listReviews(state?: ReviewQueueState): Promise<ReviewListResponse> {
    const qs = state ? `?state=${state}` : "";
    return this.request<ReviewListResponse>(`/reviews${qs}`);
  }

  /** Persisted analyses for the current user, newest first.
   *  Used by the Findings tab as a fallback when browser localStorage is empty
   *  (e.g. visiting from a different device or origin). */
  /** POST /api/v1/contact — public contact form. Auth-optional. */
  async submitContact(body: {
    name?: string | null;
    email: string;
    company?: string | null;
    topic: "general" | "sales" | "support" | "press" | "legal";
    message: string;
    page_path?: string | null;
    website?: string | null; // honeypot
  }): Promise<{ id: string; submitted_at: string }> {
    return this.request("/api/v1/contact", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  /** POST /api/v1/feedback — submit a feedback entry. Auth-optional (anon ok). */
  async submitFeedback(body: {
    mood: number;
    category: "bug" | "feature" | "ui" | "performance" | "praise";
    message: string;
    nps?: number | null;
    contact_email?: string | null;
    page_path?: string | null;
  }): Promise<{ id: string; submitted_at: string }> {
    return this.request("/api/v1/feedback", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  async listStoredAnalyses(): Promise<{
    items: Array<{
      draft_id: string;
      file_name: string;
      analyzed_at: string;
      analysis: AnalyzeContractResponse;
    }>;
  }> {
    return this.request("/api/v1/analyses");
  }

  async claimReview(itemId: string): Promise<{
    item_id: string;
    state: "in_review";
    assignee_id: string;
  }> {
    return this.request(`/reviews/${itemId}/claim`, { method: "POST" });
  }

  async decideReview(
    itemId: string,
    body: { draft_id: string; finding_id: string; decision: ReviewDecision; reviewer_note?: string }
  ): Promise<DecideResponse> {
    return this.request<DecideResponse>(`/reviews/${itemId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // --- exports ---

  async createExport(draftId: string, format: ExportFormat): Promise<ExportReportResponse> {
    return this.request<ExportReportResponse>("/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, format }),
    });
  }

  async getExport(exportId: string): Promise<ExportStatusResponse> {
    return this.request<ExportStatusResponse>(`/exports/${exportId}`);
  }

  downloadExportUrl(exportId: string): string {
    return `${this.baseUrl}/exports/${exportId}/download`;
  }

  async downloadExportBlob(exportId: string): Promise<Blob> {
    const token = this.getToken();
    const res = await fetch(this.downloadExportUrl(exportId), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {}
      throw new ApiError(res.status, body);
    }
    return await res.blob();
  }

  // --- admin ---

  async auditVerify(): Promise<AuditVerifyResponse> {
    return this.request<AuditVerifyResponse>("/audit/verify");
  }

  async softDeleteDraft(draftId: string): Promise<{ draft_id: string; deleted_at: string }> {
    return this.request(`/drafts/${draftId}`, { method: "DELETE" });
  }

  // --- reasoning (§4.12) ---

  async reasoningEvaluate(
    draftId: string,
    startupProfile?: StartupProfile
  ): Promise<ReasoningEvaluateResponse> {
    return this.request<ReasoningEvaluateResponse>("/api/v1/reasoning/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, startup_profile: startupProfile }),
    });
  }

  async reasoningGuidance(
    draftId: string,
    question: string,
    findingId?: string
  ): Promise<ReasoningGuidanceResponse> {
    return this.request<ReasoningGuidanceResponse>("/api/v1/reasoning/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, finding_id: findingId, question }),
    });
  }

  async reasoningCategories(): Promise<{ contract_version: string; categories: string[] }> {
    return this.request("/api/v1/reasoning/categories");
  }

  // --- compliance (§4.4) ---

  async complianceCheck(
    draftId: string,
    jurisdiction: string,
    regulations: string[] = []
  ): Promise<ComplianceCheckResponse> {
    return this.request<ComplianceCheckResponse>("/api/v1/compliance/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, jurisdiction, regulations }),
    });
  }

  // --- simplify (§4.5) ---

  async simplify(draftId: string): Promise<SimplifyResponse> {
    return this.request<SimplifyResponse>(`/api/v1/simplify/${draftId}`);
  }

  // --- negotiate (§4.6) ---

  async negotiate(draftId: string, findingIds: string[] = []): Promise<NegotiateResponse> {
    return this.request<NegotiateResponse>("/api/v1/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, finding_ids: findingIds }),
    });
  }

  // --- compare (§4.7) ---

  async compare(draftIds: string[]): Promise<CompareResponse> {
    return this.request<CompareResponse>("/api/v1/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_ids: draftIds }),
    });
  }

  // --- search (§4.9) ---

  async search(query: string, risk?: string): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (risk) params.set("risk", risk);
    return this.request<SearchResponse>(`/api/v1/search?${params.toString()}`);
  }

  // --- comments (§4.10) ---

  async createComment(
    draftId: string,
    body: string,
    findingId?: string
  ): Promise<CommentView> {
    return this.request<CommentView>("/api/v1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, finding_id: findingId, body }),
    });
  }

  async listComments(draftId: string): Promise<CommentListResponse> {
    return this.request<CommentListResponse>(
      `/api/v1/comments?draft_id=${encodeURIComponent(draftId)}`
    );
  }

  // --- workflow (§4.8) ---

  async workflowAssign(itemId: string, assigneeId: string): Promise<WorkflowAssignResponse> {
    return this.request<WorkflowAssignResponse>("/api/v1/workflow/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, assignee_id: assigneeId }),
    });
  }

  // --- webhooks (§4.11) ---

  async createWebhook(url: string, event: string, secret?: string): Promise<WebhookView> {
    return this.request<WebhookView>("/api/v1/integrations/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, event, secret }),
    });
  }

  async listWebhooks(): Promise<WebhookListResponse> {
    return this.request<WebhookListResponse>("/api/v1/integrations/webhooks");
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request<void>(`/api/v1/integrations/webhooks/${id}`, { method: "DELETE" });
  }
}
