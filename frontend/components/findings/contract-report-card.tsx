import type { ContractReport, RiskLevel } from "../../lib/contracts";

type Props = { report: ContractReport };

const SEVERITY_PILL: Record<RiskLevel, string> = {
  critical: "bg-rose-100 text-rose-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-sky-100 text-sky-900",
  low: "bg-emerald-100 text-emerald-900",
};

const SEVERITY_BORDER: Record<RiskLevel, string> = {
  critical: "border-l-rose-500",
  high: "border-l-orange-500",
  medium: "border-l-sky-500",
  low: "border-l-emerald-500",
};

export function ContractReportCard({ report }: Props) {
  return (
    <section className="flex flex-col gap-6">
      <header className="crystal-glass rounded-3xl p-6 border-l-4 border-l-primary">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            Reasoning report · {report.model_name}
          </span>
        </div>
        <h2 className="font-h2 text-h2 text-onboarding-navy mt-0 mb-2">Executive summary</h2>
        <p className="text-body-lg text-on-surface">{report.executive_summary}</p>
      </header>

      <section className="crystal-glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-status-warn">warning</span>
          <h3 className="font-h3 text-h3 text-onboarding-navy m-0">
            Loopholes &amp; risky clauses ({report.loopholes.length})
          </h3>
        </div>
        {report.loopholes.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant m-0">
            None detected by the reasoning model.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 m-0 p-0 list-none">
            {report.loopholes.map((l, i) => (
              <li
                key={i}
                className={`p-4 rounded-xl border-l-4 ${SEVERITY_BORDER[l.severity]} bg-white/50`}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <strong className="font-h3 text-h3">{l.clause_name}</strong>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${SEVERITY_PILL[l.severity]}`}
                  >
                    {l.severity}
                  </span>
                </div>
                <blockquote className="border-l-2 border-on-surface-variant/30 pl-3 italic text-body-sm text-on-surface-variant mb-2 m-0">
                  &ldquo;{l.excerpt}&rdquo;
                </blockquote>
                <p className="text-body-sm text-on-surface m-0 mb-1">
                  <strong>Issue: </strong>
                  {l.issue}
                </p>
                <p className="text-body-sm text-on-surface-variant m-0">
                  <strong>Impact: </strong>
                  {l.impact}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crystal-glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-status-success">edit_note</span>
          <h3 className="font-h3 text-h3 text-onboarding-navy m-0">
            Suggested replacement clauses ({report.suggestions.length})
          </h3>
        </div>
        {report.suggestions.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant m-0">No suggestions.</p>
        ) : (
          <ul className="flex flex-col gap-4 m-0 p-0 list-none">
            {report.suggestions.map((s, i) => (
              <li key={i} className="p-4 rounded-xl bg-white/50 border border-glass-border">
                <div className="font-h3 text-h3 mb-3">{s.clause_name}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-1">
                      Original
                    </div>
                    <p className="text-body-sm text-on-surface-variant italic bg-rose-50 rounded p-3 m-0 border-l-2 border-l-rose-300">
                      &ldquo;{s.original_excerpt}&rdquo;
                    </p>
                  </div>
                  <div>
                    <div className="font-label-caps text-label-caps uppercase text-status-success mb-1">
                      Replacement (favors you)
                    </div>
                    <p className="text-body-sm text-on-surface bg-emerald-50 rounded p-3 m-0 border-l-2 border-l-emerald-400">
                      {s.suggested_clause}
                    </p>
                  </div>
                </div>
                <p className="text-body-sm text-on-surface mt-3 m-0">
                  <strong>Why: </strong>
                  {s.rationale}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className={`crystal-glass rounded-3xl p-6 border-l-4 ${
          report.cross_verification.risks_resolved ? "border-l-status-success" : "border-l-status-warn"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`material-symbols-outlined ${
              report.cross_verification.risks_resolved ? "text-status-success" : "text-status-warn"
            }`}
          >
            {report.cross_verification.risks_resolved ? "verified" : "rule"}
          </span>
          <h3 className="font-h3 text-h3 text-onboarding-navy m-0">Cross-verification</h3>
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              report.cross_verification.risks_resolved
                ? "bg-status-success/10 text-status-success"
                : "bg-status-warn/10 text-status-warn"
            }`}
          >
            {report.cross_verification.risks_resolved ? "Risks resolved" : "Residual risk"}
          </span>
        </div>
        {report.cross_verification.notes ? (
          <p className="text-body-sm text-on-surface mb-2">
            <strong>Audit: </strong>
            {report.cross_verification.notes}
          </p>
        ) : null}
        {report.cross_verification.residual_concerns ? (
          <p className="text-body-sm text-on-surface-variant m-0">
            <strong>Residual concerns: </strong>
            {report.cross_verification.residual_concerns}
          </p>
        ) : null}
      </section>
    </section>
  );
}
