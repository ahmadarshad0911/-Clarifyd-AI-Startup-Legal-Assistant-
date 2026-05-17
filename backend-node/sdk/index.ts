// Clarifyd backend client SDK. Drop into frontend (`src/lib/clarifyd.ts`) and use:
//   import { client } from '@/lib/clarifyd';
//   const me = await client.me();

export interface ClientConfig {
  baseUrl?: string;       // default: same origin
  credentials?: RequestCredentials;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'clean';

export interface Finding {
  id: string;
  clauseId: string;
  severity: Severity;
  score: number;
  confidence: number;
  originalText: string;
  rewriteText: string | null;
  rationale: string | null;
  userDecision: 'accepted' | 'rejected' | 'edited' | null;
}

export interface Scan {
  id: string;
  contractId: string;
  status: 'queued' | 'running' | 'done' | 'error';
  healthScore: number | null;
  criticalN: number;
  highN: number;
  mediumN: number;
  cleanN: number;
  model: string;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  createdAt: string;
  usage: { scansThisMonth: number; limit: number; remaining: number };
  context: { jurisdiction: string; stage: string; role: string };
}

export function createClient(cfg: ClientConfig = {}) {
  const base = cfg.baseUrl ?? '';
  const creds = cfg.credentials ?? 'include';

  const req = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      credentials: creds,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      let detail: unknown;
      try { detail = await res.json(); } catch { detail = await res.text(); }
      throw new ClarifydError(res.status, detail);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  };

  return {
    me: () => req<MeResponse>('/api/me'),
    health: (deep = false) => req(`/api/health${deep ? '?deep=1' : ''}`),
    posture: () => req('/api/security/posture'),

    contracts: {
      upload: async (file: File): Promise<{ contractId: string; sha256: string; bytes: number }> => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${base}/api/contracts`, { method: 'POST', body: fd, credentials: creds });
        if (!res.ok) throw new ClarifydError(res.status, await res.text());
        return res.json();
      },
    },

    classify: (contractId: string) =>
      req<{ type: string; confidence: number; cached?: boolean }>('/api/classify', {
        method: 'POST',
        body: JSON.stringify({ contractId }),
      }),

    scans: {
      start: (contractId: string) =>
        req<{ scanId: string; streamUrl: string }>('/api/scans', {
          method: 'POST',
          body: JSON.stringify({ contractId }),
        }),
      get: (id: string) => req<Scan>(`/api/scans/${id}`),
      findings: (id: string) => req<{ scan: Scan; findings: Finding[] }>(`/api/scans/${id}/findings`),
      stream: (id: string) => new EventSource(`${base}/api/scans/${id}/stream`, { withCredentials: true }),
      export: (id: string, format: 'pdf' | 'docx' | 'txt' | 'clipboard') =>
        fetch(`${base}/api/scans/${id}/export`, {
          method: 'POST',
          credentials: creds,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format }),
        }),
    },

    clauses: {
      decide: (id: string, decision: 'accepted' | 'rejected' | 'edited', editText?: string) =>
        req<{ ok: true }>(`/api/clauses/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ decision, editText }),
        }),
      emailDraft: (id: string) =>
        req<{ to: string; subject: string; body: string; tokens: Record<string, string> }>(
          `/api/clauses/${id}/email-draft`,
        ),
    },

    context: {
      get: () => req<{ jurisdiction: string; stage: string; role: string }>('/api/user/context'),
      set: (ctx: { jurisdiction: string; stage: string; role: string }) =>
        req<{ ok: true }>('/api/user/context', { method: 'PUT', body: JSON.stringify(ctx) }),
    },

    compare: (scanId: string, corpus: 'yc-w26' | 'uk-standard' | 'eu-standard' | 'user' = 'yc-w26') =>
      req(`/api/compare/${scanId}?corpus=${corpus === 'user' ? `user:${'me'}` : corpus}`),

    deadlines: {
      list: () => req('/api/monitor/deadlines'),
      create: (d: { kind: string; label: string; dueAt: string; contractId?: string }) =>
        req('/api/monitor/deadlines', { method: 'POST', body: JSON.stringify(d) }),
      update: (id: string, body: { status: 'snoozed' | 'dismissed' | 'active'; snoozeUntil?: string }) =>
        req(`/api/monitor/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    },

    lawyers: {
      list: (jurisdiction?: string) =>
        req(`/api/lawyers${jurisdiction ? `?jurisdiction=${jurisdiction}` : ''}`),
      handoff: (lawyerId: string, scanId: string) =>
        req<{ handoffId: string }>('/api/lawyer-handoff', {
          method: 'POST',
          body: JSON.stringify({ lawyerId, scanId }),
        }),
    },

    library: {
      ask: (question: string) =>
        req<{ answer: string; citations: number }>('/api/library/ask', {
          method: 'POST',
          body: JSON.stringify({ question }),
        }),
    },

    integrations: {
      list: () => req('/api/integrations'),
      connectUrl: (provider: 'slack' | 'gmail' | 'drive' | 'notion') =>
        `${base}/api/integrations/${provider}/connect`,
      disconnect: (provider: 'slack' | 'gmail' | 'drive' | 'notion') =>
        req(`/api/integrations/${provider}/disconnect`, { method: 'POST' }),
    },

    audit: {
      get: (scanId: string) => req(`/api/audit/${scanId}`),
      exportUrl: (scanId: string) => `${base}/api/audit/${scanId}/export`,
    },

    consent: (choice: 'accept-all' | 'essential-only' | 'custom', details?: Record<string, unknown>) =>
      req('/api/consent', { method: 'POST', body: JSON.stringify({ choice, details }) }),
  };
}

export class ClarifydError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(`Clarifyd ${status}`);
  }
}

export const client = createClient();
