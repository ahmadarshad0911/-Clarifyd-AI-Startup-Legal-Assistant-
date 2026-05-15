type Props = {
  /** Cover the whole viewport with a fixed overlay. Default true. */
  fullscreen?: boolean;
  /** Optional override for the rotating status lines. */
  statusLines?: string[];
  /** Single static label instead of the cycling typewriter. */
  label?: string;
};

const DEFAULT_STATUS = ["Decrypting…", "Analyzing architecture…", "Mapping risk…"];

export function OrbitalLoader({ fullscreen = true, statusLines, label }: Props) {
  const lines = statusLines ?? DEFAULT_STATUS;
  const wrapper = fullscreen
    ? "fixed inset-0 z-[200] flex flex-col items-center justify-center aurora-bg"
    : "relative flex flex-col items-center justify-center py-12";

  return (
    <div className={wrapper} role="status" aria-live="polite">
      {fullscreen ? (
        <div className="absolute inset-0 bg-on-surface/5 backdrop-blur-[2px] pointer-events-none" />
      ) : null}

      <div className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80">
        <div className="absolute inset-0 bg-accent-violet/10 blur-[80px] rounded-full" />
        {/* Outer ring */}
        <div className="absolute w-60 h-60 md:w-72 md:h-72 rounded-full border border-primary/20 orbital-ring-1" />
        {/* Middle ring */}
        <div className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border-[3px] border-transparent border-t-accent-violet/60 border-l-primary/40 orbital-ring-2" />
        {/* Inner ring */}
        <div className="absolute w-36 h-36 md:w-44 md:h-44 rounded-full border-[4px] border-transparent border-t-primary border-b-accent-indigo orbital-ring-3" />
        {/* Scanning beam */}
        <div className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full scanning-beam z-30 pointer-events-none" />
        {/* Central glass core */}
        <div className="absolute w-28 h-28 md:w-32 md:h-32 rounded-full bg-white/70 backdrop-blur-2xl border border-white/60 shadow-2xl z-40 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[#22d3ee]/5 blur-xl" />
          <div className="pulse-soft relative">
            <span
              className="material-symbols-outlined text-5xl text-onboarding-navy"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              security
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center z-50">
        <div className="h-8 relative flex items-center justify-center">
          {label ? (
            <p className="font-display-hero text-h3 text-onboarding-navy italic tracking-wide m-0">
              {label}
            </p>
          ) : (
            lines.map((line, i) => (
              <p
                key={i}
                className="loader-status-line absolute font-display-hero text-h3 text-onboarding-navy italic tracking-wide m-0"
              >
                {line}
              </p>
            ))
          )}
        </div>
        <p className="mt-6 text-body-sm text-on-surface-variant max-w-xs mx-auto opacity-80">
          Your documents are encrypted with banking-grade security and processed for analysis.
        </p>
      </div>
    </div>
  );
}
