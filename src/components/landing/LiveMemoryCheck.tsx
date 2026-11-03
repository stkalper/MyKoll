import { MemoryCheck } from "@/components/file/MemoryCheck";
import type { LiveStats } from "@/lib/live";
import { effectLabel, memoryCheckReady, type MemoryEffectKind } from "@/lib/view";

/**
 * What the memory has done across every chat, from production: how often it changed what the bot
 * did, and the memory check once there's enough to score it.
 */
export function LiveMemoryCheck({ stats }: { stats: LiveStats | null }) {
  const check = stats?.memoryCheck;
  const effects = Object.entries(stats?.memoryEffects ?? {}) as [MemoryEffectKind, number][];
  const ready = check && memoryCheckReady(check);
  if (!ready && !effects.length) return null;
  return (
    <div className="mb-14 max-w-xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">Live, across every chat</p>
      {effects.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
          {effects.map(([kind, n]) => (
            <li key={kind}>
              <span className="font-semibold tabular-nums">{n}</span> <span className="text-muted">{effectLabel[kind]}</span>
            </li>
          ))}
        </ul>
      )}
      {ready && <MemoryCheck check={check} className="rotate-[0.4deg]" />}
    </div>
  );
}
