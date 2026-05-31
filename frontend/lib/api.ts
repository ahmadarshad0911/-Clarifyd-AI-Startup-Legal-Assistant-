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
/**
 * Hosts that previously served the backend but no longer do. Any env
 * value pointing at one of these is treated as dead and skipped — the
 * resolver falls through to the local dev backend (or to whatever the
 * surrounding context provides). Keep this list non-empty; that's how
 * the dead `clarifyd-backend.vercel.app` URL never bites us again.
 */
const DEAD_BACKEND_HOSTS: ReadonlySet<string> = new Set([
  "clarifyd-backend.vercel.app",
]);
const PUBLIC_PROXY = "/api";

function firstValidationIssueMessage(details: Record<string, unknown>): string | null {
  const issues = details.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const first = issues[0];
    if (first && typeof first === "object") {
      const obj = first as Record<string, unknown>;
      const msg = typeof obj.msg === "string" ? obj.msg : null;
      const loc = Array.isArray(obj.loc)
        ? obj.loc.filter((v): v is string | number => typeof v === "string" || typeof v === "number")
        : [];
      if (msg && loc.length > 1) {
        return `${loc.slice(1).join(" -> ")}: ${msg}`;
      }
      if (msg) return msg;
    }
  }

  // Backward compatibility: some backend builds stringify validation issues.
  if (typeof issues === "string") {
    const m = /'msg':\s*'([^']+)'/.exec(issues);
    if (m && m[1]) return m[1];
  }
  return null;
}

function normalizeBaseUrl(value?: string): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/\/+$/, "");
}

function isDeadHost(url: string): boolean {
  try {
    return DEAD_BACKEND_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl(baseUrl?: string): string {
  const explicitBase = normalizeBaseUrl(baseUrl);
  if (explicitBase && !isDeadHost(explicitBase)) return explicitBase;

  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  if (!envBase) {
    if (typeof window !== "undefined") {
      return PUBLIC_PROXY;
    }
    return DEFAULT_BASE_URL;
  }

  // Env points at a known-dead host (legacy deploy that returns 404 on
  // every path). Never use it.
  if (isDeadHost(envBase)) {
    if (typeof window !== "undefined") {
      const isLocalFrontend = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
      if (isLocalFrontend) return DEFAULT_BASE_URL;
      // Same-origin fallback for deployed frontends — Next can be wired to
      // proxy /api/* to the live backend via next.config.js rewrites.
      return PUBLIC_PROXY;
    }
    return DEFAULT_BASE_URL;
  }

  return envBase;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  requestId: string;

  constructor(status: number, body: StructuredApiError | { detail?: unknown } | unknown) {
    const envelope = (body as StructuredApiError)?.error;
    const details = (envelope?.details ?? {}) as Record<string, unknown>;
    const validationMessage =
      envelope?.code === "request_validation_error"
        ? firstValidationIssueMessage(details)
        : null;
    const message = validationMessage ?? envelope?.message ?? `Request failed with status ${status}`;
    super(message);
    this.status = status;
    this.code = envelope?.code ?? "unknown_error";
    this.details = details;
    this.requestId = envelope?.request_id ?? "";
  }
}

export type TokenProvider = () => string | null | Promise<string | null>;

export class ApiClient {
  baseUrl: string;
  private getToken: TokenProvider;

  constructor(getToken: TokenProvider, baseUrl?: string) {
    this.baseUrl = resolveApiBaseUrl(baseUrl);
    this.getToken = getToken;
  }

  private async headers(extra?: HeadersInit): Promise<HeadersInit> {
    const h: Record<string, string> = {
      Accept: "application/json",
      ...((extra as Record<string, string> | undefined) ?? {}),
    };
    const token = await this.getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    // A thrown fetch (network/DNS, or backend mid-restart during a deploy)
    // means the request never reached the server, so retrying is safe even
    // for POST. Back off, then give up with a clear error.
    const backoffsMs = [600, 1500, 3000];
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: await this.headers(init.headers),
        });
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < backoffsMs.length) {
          await new Promise((r) => setTimeout(r, backoffsMs[attempt]));
        }
      }
    }
    if (res === null) {
      throw new ApiError(0, {
        error: {
          code: "backend_unreachable",
          message: `Cannot reach backend at ${this.baseUrl}. Backend may be offline or NEXT_PUBLIC_API_URL is misconfigured.`,
          details: { underlying: lastErr instanceof Error ? lastErr.message : String(lastErr) },
          request_id: "",
        },
      } satisfies StructuredApiError);
    }
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

  /** OTP gate currently disabled — backend issues a LoginResponse here.
   *  When the gate is re-enabled it returns
   *  `{verification_required, email, expires_in}` instead. */
  async register(body: LoginRequest): Promise<
    | LoginResponse
    | { verification_required: boolean; email: string; expires_in: number }
  > {
    return this.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async verifyOtp(body: { email: string; otp: string }): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async resendOtp(body: { email: string }): Promise<{
    verification_required: boolean;
    email: string;
    expires_in: number;
  }> {
    return this.request("/auth/resend-otp", {
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

  /**
   * Streaming variant — invokes onChunk with reply fragments as they arrive
   * so the chat feels instant. Throws ApiError on non-2xx (incl. the 422
   * off-topic case) before any chunk is emitted.
   */
  async copilotGuidanceStream(
    template: string,
    message: string,
    history: CopilotMessage[],
    mode: CopilotMode,
    onChunk: (text: string) => void,
  ): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/api/v1/copilot/guidance/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ template, message, history, mode }),
    });
    if (!res.ok || !res.body) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      throw new ApiError(res.status, body);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text) onChunk(text);
      }
      // Flush any trailing multibyte sequence held across the last chunk.
      const tail = decoder.decode();
      if (tail) onChunk(tail);
    } finally {
      // Always release the lock, even if onChunk throws or the stream errors.
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }
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
      negotiated_at: string | null;
      analysis: AnalyzeContractResponse;
    }>;
  }> {
    return this.request("/api/v1/analyses");
  }

  /** Flag a draft as actively negotiated. Idempotent on backend. */
  async markAnalysisNegotiated(
    draftId: string
  ): Promise<{ draft_id: string; negotiated_at: string }> {
    return this.request(`/api/v1/analyses/${encodeURIComponent(draftId)}/negotiate`, {
      method: "POST",
    });
  }

  /** Re-run ContractReporter for a draft whose report was null (API key missing at analysis time). */
  async regenerateReport(
    draftId: string
  ): Promise<{ draft_id: string; report_generated: boolean }> {
    return this.request(`/api/v1/analyses/${encodeURIComponent(draftId)}/regenerate-report`, {
      method: "POST",
    });
  }

  // --- admin ---

  async adminListUsers(): Promise<{
    items: Array<{
      id: string;
      email: string;
      role: string;
      created_at: string;
      email_verified: boolean;
      drafts: number;
    }>;
  }> {
    // Cache-bust so a freshly created/deleted user shows immediately — these
    // GETs were otherwise served stale by the browser/edge cache.
    return this.request(`/admin/users?t=${Date.now()}`);
  }

  async adminStats(): Promise<{
    users_total: number;
    users_last_7d: number;
    drafts_total: number;
    drafts_last_7d: number;
    feedback_total: number;
    admins: number;
  }> {
    return this.request(`/admin/stats?t=${Date.now()}`);
  }

  async adminDeleteUser(userId: string): Promise<{ id: string; deleted: boolean }> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  }

  async oauthProviders(): Promise<{ google: boolean; facebook: boolean }> {
    return this.request("/auth/oauth/providers");
  }

  /** Right-to-erasure: delete the signed-in user's account + all their data. */
  async deleteAccount(): Promise<{ deleted: boolean }> {
    return this.request("/auth/account", { method: "DELETE" });
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
    const token = await this.getToken();
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
