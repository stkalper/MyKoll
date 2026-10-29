import type { MemoryCheckView } from "@/lib/view";

/** Enough settled calls with a record behind them to say anything (same bar as the chat's line). */
const enough = (c: MemoryCheckView) => c.calls >= 5 && c.withRecord >= 3 && c.brierMemory !== null;

const pct = (x: { calls: number; hits: number }) => Math.round((x.hits / x.calls) * 100);

/**
 * Is the memory earning its keep? The bot's trust in each call, scored against how it ended
 * (Brier, lower is better), next to a bot that forgets and trusts everyone 50/50.
 */
export function MemoryCheck({ check, className = "" }: { check: MemoryCheckView; className?: string }) {
  if (!enough(check))
    return (
      <div className={`paper rounded-sm px-5 py-4 ${className}`}>
        <p className="field-label">Memory check</p>
        <p className="mt-2 font-mono text-sm">
          {check.calls} settled call{check.calls === 1 ? "" : "s"} so far. After a few more, this shows whether what I remember predicts who&apos;s right.
        </p>
      </div>
    );

  const bars = [
    { label: "With memory", value: check.brierMemory!, tone: "bg-stamp-win" },
    { label: "A bot that forgets", value: check.brierForgetful!, tone: "bg-ink-muted" },
  ];
  return (
    <div className={`paper rounded-sm px-5 py-4 ${className}`}>
      <p className="field-label">Memory check · {check.calls} settled calls</p>
      <p className="mt-1 font-hand text-xl leading-tight text-ink-muted">How well my trust predicted the outcome. Lower is better.</p>
      <div className="mt-3 space-y-2">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3 font-mono text-xs">
            <span className="w-36 shrink-0">{b.label}</span>
            <span className="h-3 flex-1 border-2 border-ink">
              <span className={`block h-full ${b.tone}`} style={{ width: `${Math.min(100, (b.value / 0.25) * 70)}%` }} />
            </span>
            <span className="w-12 text-right tabular-nums">{b.value.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t-2 border-dashed border-rule pt-3 font-mono text-[0.7rem]">
        {(
          [
            ["⚠️ weak spot", check.spots.weak],
            ["🔥 strong spot", check.spots.strong],
            ["no flag", check.spots.none],
          ] as const
        ).map(([label, s]) => (
          <span key={label}>
            <span className="field-label block">{label}</span>
            {s.calls ? `${pct(s)}% right (${s.hits}/${s.calls})` : "—"}
          </span>
        ))}
      </div>
    </div>
  );
}
