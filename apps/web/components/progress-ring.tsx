/** Round progress like the Figma "ongoing task" ring: blue done, orange still to go. */
export function ProgressRing({ value, size = 54 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={`${pct}%`}
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          className="stroke-accent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className="stroke-primary"
        />
      </svg>
      <span className="absolute text-label text-primary">{pct}%</span>
    </div>
  );
}
