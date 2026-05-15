import type { AnalyzeContractResponse } from "../../lib/contracts";

type Props = {
  result: AnalyzeContractResponse | null;
  fileName?: string | null;
};

const STEPS = [
  { key: "uploaded", label: "Uploaded", icon: "check" },
  { key: "extracted", label: "Extracted", icon: "analytics" },
  { key: "tagged", label: "Tagged", icon: "label" },
  { key: "reasoned", label: "Reasoned", icon: "psychology" },
];

export function ProcessingStatus({ result, fileName }: Props) {
  const activeIndex = result ? STEPS.length - 1 : -1;
  const inFlightIndex = result ? -1 : 1;

  return (
    <section className="crystal-glass rounded-3xl p-6">
      <header className="flex items-baseline gap-3 mb-6">
        <h3 className="font-h3 text-h3 text-onboarding-navy">Active Pipeline</h3>
        {fileName ? (
          <span className="text-body-sm text-on-surface-variant">{fileName}</span>
        ) : null}
      </header>

      {result ? (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="bg-primary-container/10 text-primary px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            Draft {result.draft_id.slice(0, 8)}…
          </span>
          <span className="bg-status-warn/10 text-status-warn px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            Highest: {result.summary.highest_risk}
          </span>
          <span className="bg-status-info/10 text-status-info px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            Score {result.summary.overall_score}/10
          </span>
          <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            {result.summary.findings_count} findings
          </span>
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative">
        {STEPS.map((step, index) => {
          const isDone = index <= activeIndex;
          const isCurrent = index === inFlightIndex;
          const dotBg = isDone
            ? "bg-status-success text-white"
            : isCurrent
            ? "bg-primary-container text-white animate-pulse"
            : "bg-surface-variant text-on-surface-variant";
          const labelColor = isDone
            ? "text-status-success"
            : isCurrent
            ? "text-primary"
            : "text-on-surface-variant";
          const opacity = !isDone && !isCurrent ? "opacity-50" : "";
          return (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <div className={`flex flex-col items-center gap-2 z-10 ${opacity}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dotBg}`}>
                  <span className="material-symbols-outlined">{step.icon}</span>
                </div>
                <span className={`text-label-caps font-label-caps ${labelColor}`}>{step.label}</span>
              </div>
              {index < STEPS.length - 1 ? (
                <div
                  className={`hidden md:block flex-1 h-[2px] -mt-6 ${
                    index < activeIndex ? "bg-status-success/30" : "bg-outline-variant"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {!result ? (
        <p className="mt-6 text-body-sm text-on-surface-variant">
          Awaiting upload — pick a contract above to start the pipeline.
        </p>
      ) : null}
    </section>
  );
}
