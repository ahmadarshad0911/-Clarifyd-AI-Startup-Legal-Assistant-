type Props = { value: number; size?: number; color?: string };

export function ConfidenceRing({ value, size = 36, color = "#4f46e5" }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  const radius = size / 2 - 4;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  const labelPct = Math.round(pct * 100);
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`confidence ${labelPct}%`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(15,23,42,0.10)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle">
        {labelPct}
      </text>
    </svg>
  );
}
