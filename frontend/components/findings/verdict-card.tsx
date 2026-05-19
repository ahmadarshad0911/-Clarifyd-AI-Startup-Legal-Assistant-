import type { AnalyzeContractResponse } from "../../lib/contracts";

type Props = { analysis: AnalyzeContractResponse; fileName?: string | null };

type VerdictKey = "critical" | "high" | "medium" | "low";

const VERDICT: Record<
  VerdictKey,
  { label: string; tone: string; ring: string; chip: string; icon: string; advice: string }
> = {
  critical: {
    label: "DO NOT SIGN — critical risks",
    tone: "from-rose-600 to-rose-800",
    ring: "ring-rose-300",
    chip: "bg-rose-100 text-rose-900",
    icon: "block",
    advice:
      "Clarifyd AI flagged critical clauses (unlimited liability, uncapped damages, or similar). Renegotiate before signing.",
  },
  high: {
    label: "RENEGOTIATE — high-risk clauses",
    tone: "from-orange-500 to-orange-700",
    ring: "ring-orange-300",
    chip: "bg-orange-100 text-orange-900",
    icon: "warning",
    advice:
      "Several clauses materially favor the counterparty. Push back on liability caps, termination, and IP scope.",
  },
  medium: {
    label: "REVIEW — medium-risk concerns",
    tone: "from-sky-500 to-indigo-600",
    ring: "ring-sky-300",
    chip: "bg-sky-100 text-sky-900",
    icon: "search",
    advice:
      "Ambiguous or imbalanced terms detected. Clarify definitions and add carve-outs before signing.",
  },
  low: {
    label: "ACCEPTABLE — minor concerns",
    tone: "from-emerald-500 to-emerald-700",
    ring: "ring-emerald-300",
    chip: "bg-emerald-100 text-emerald-900",
    icon: "check_circle",
    advice: "No critical or high-risk clauses found. Standard counsel review still recommended.",
  },
};

export function VerdictCard({ analysis, fileName }: Props) {
  const key = (analysis.summary.highest_risk as VerdictKey) ?? "low";
  const v = VERDICT[key] ?? VERDICT.low;
  const score = analysis.summary.overall_score;
  const findings = analysis.summary.findings_count;
  const criticalCount = analysis.findings.filter((f) => f.risk_level === "critical").length;
  const highCount = analysis.findings.filter((f) => f.risk_level === "high").length;
  const mediumCount = analysis.findings.filter((f) => f.risk_level === "medium").length;

  return (
    <section
      className={`crystal-glass rounded-3xl overflow-hidden border-0 ring-4 ${v.ring} shadow-2xl`}
    >
      <div className={`bg-gradient-to-r ${v.tone} text-white p-8 relative`}>
        <div className="absolute -right-8 -top-8 opacity-20">
          <span className="material-symbols-outlined" style={{ fontSize: 220 }}>
            {v.icon}
          </span>
        </div>
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
              {v.icon}
            </span>
            <span className="font-label-caps text-label-caps uppercase tracking-widest opacity-90">
              Clarifyd AI verdict
            </span>
          </div>
          <h2 className="font-display-hero text-h1 m-0">{v.label}</h2>
          <p className="text-body-lg opacity-95 max-w-3xl">{v.advice}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${v.chip}`}>
              Risk score {score}/10
            </span>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white">
              {findings} finding{findings === 1 ? "" : "s"}
            </span>
            {criticalCount ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900">
                {criticalCount} critical
              </span>
            ) : null}
            {highCount ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-orange-900">
                {highCount} high
              </span>
            ) : null}
            {mediumCount ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-100 text-sky-900">
                {mediumCount} medium
              </span>
            ) : null}
            {fileName ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/20 text-white">
                {fileName}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
