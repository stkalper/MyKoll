/**
 * A member's ID badge, clipped to their file: what the bot has learned about them
 * from their settled calls (the learning loop, made visible).
 */
export function MemberBadge({
  name,
  hits,
  calls,
  strong = [],
  weak = [],
  className = "",
  ...rest
}: {
  name: string;
  hits: number;
  calls: number;
  strong?: string[];
  weak?: string[];
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`relative w-[300px] rounded-xl border-2 border-outline bg-[#dfe3ea] p-1.5 shadow-[4px_6px_0_rgba(0,0,0,0.45)] ${className}`}>
      <span className="absolute -top-3 left-1/2 h-5 w-14 -translate-x-1/2 rounded-md border-2 border-outline bg-[#9aa3b2]" />
      <div className="rounded-lg bg-paper p-3 text-ink">
        <div className="flex items-center justify-between rounded-md bg-ink px-2.5 py-1.5 text-paper">
          <span className="font-form text-[0.7rem] font-extrabold uppercase tracking-[0.1em]">Dept. of Receipts</span>
          <span className="font-mono text-[0.6rem]">MEMBER FILE</span>
        </div>
        <div className="mt-3 flex gap-3">
          <div className="grid h-16 w-14 shrink-0 place-items-center rounded-sm border-2 border-ink bg-paper-shade font-form text-2xl font-extrabold">
            {name.replace("@", "").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="field-label">Name</p>
            <p className="truncate font-mono text-sm font-semibold">{name}</p>
            <p className="field-label mt-1">Record</p>
            <p className="font-mono text-sm">
              {hits}/{calls} right · {calls ? Math.round((hits / calls) * 100) : 0}%
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1 font-mono text-[0.7rem]">
          {strong.map((s) => (
            <p key={s}>
              <span className="hl">↑ {s}</span>
            </p>
          ))}
          {weak.map((s) => (
            <p key={s}>
              <span className="hl hl-pink">↓ {s}</span>
            </p>
          ))}
        </div>
        <div className="mt-3 flex items-end justify-between">
          <svg width="120" height="22" viewBox="0 0 120 22" aria-hidden>
            {Array.from({ length: 34 }, (_, i) => (
              <rect key={i} x={i * 3.5} y="0" width={i % 3 ? 1.5 : 2.5} height="22" fill="var(--ink)" />
            ))}
          </svg>
          <span className="font-mono text-[0.55rem] text-ink-muted">learned from calls</span>
        </div>
      </div>
    </div>
  );
}
