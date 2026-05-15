"use client";

import { useEffect, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type { AuditVerifyResponse } from "../../lib/contracts";

export function AuditVerifyCard() {
  const { client } = useAuth();
  const { push } = useToast();
  const [state, setState] = useState<AuditVerifyResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      const res = await client.auditVerify();
      setState(res);
      push(
        res.intact ? "Audit chain intact." : `Audit broken at ${res.first_break_id}.`,
        res.intact ? "success" : "error"
      );
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Verify failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card">
      <header style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <h2>Audit chain</h2>
        <span className="muted">SHA-256 hash chain over all events</span>
      </header>
      <p className="muted">
        Each audit row is hashed with the previous row&apos;s hash. Tampering
        breaks the chain — verifiable independently of trust in the application.
      </p>
      <div className="row">
        {state ? (
          state.intact ? (
            <span className="audit-badge ok">✓ intact</span>
          ) : (
            <span className="audit-badge bad">⚠ broken at {state.first_break_id}</span>
          )
        ) : (
          <span className="audit-badge unknown">… checking</span>
        )}
        <span className="spacer" />
        <button type="button" className="ghost" onClick={check} disabled={busy}>
          {busy ? "Verifying…" : "Re-verify"}
        </button>
      </div>
    </section>
  );
}
