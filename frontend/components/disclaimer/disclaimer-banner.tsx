"use client";

import { ReactNode, useEffect, useState } from "react";

const ACK_KEY = "clarifyd.disclaimer-ack";

export function DisclaimerGate({ children }: { children: ReactNode }) {
  const [acked, setAcked] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAcked(window.sessionStorage.getItem(ACK_KEY) === "1");
  }, []);

  if (acked === null) return null;
  if (acked) return <>{children}</>;

  function accept() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ACK_KEY, "1");
    }
    setAcked(true);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div className="modal-card glass">
        <h1 id="disclaimer-title">Decision-support only</h1>
        <p>
          Clarifyd surfaces contract risk and routes findings to human reviewers.
          Outputs are <strong>not legal advice</strong> and must be reviewed by a
          qualified professional. Confidence scores and severity labels are
          probabilistic estimates.
        </p>
        <p className="muted">
          By continuing you acknowledge this is a decision-support tool. Decisions you record are auditable and tamper-evident.
        </p>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>I understand this tool does not provide legal advice.</span>
        </label>
        <button type="button" onClick={accept} disabled={!checked}>
          Continue to workspace
        </button>
      </div>
    </div>
  );
}
