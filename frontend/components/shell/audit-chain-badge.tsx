"use client";

import { useEffect, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type State = "unknown" | "ok" | "bad";

export function AuditChainBadge() {
  const { client, role } = useAuth();
  const [state, setState] = useState<State>("unknown");
  const [breakAt, setBreakAt] = useState<number | null>(null);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const res = await client.auditVerify();
        if (cancelled) return;
        setState(res.intact ? "ok" : "bad");
        setBreakAt(res.first_break_id);
      } catch (err) {
        if (cancelled) return;
        setState("unknown");
        if (err instanceof ApiError && err.status === 401) return;
      }
      if (!cancelled) {
        timer = window.setTimeout(
          tick,
          document.visibilityState === "visible" ? 60_000 : 5 * 60_000
        );
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [client, role]);

  if (role !== "admin") {
    return (
      <span className="audit-badge unknown" title="Audit chain status visible to admins only">
        🔒 audit private
      </span>
    );
  }

  if (state === "ok") return <span className="audit-badge ok">✓ audit chain intact</span>;
  if (state === "bad")
    return (
      <span className="audit-badge bad" title={`First mismatch at id ${breakAt}`}>
        ⚠ audit broken at {breakAt}
      </span>
    );
  return <span className="audit-badge unknown">… checking audit</span>;
}
