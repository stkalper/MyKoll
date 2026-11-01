"use client";

import { useEffect, useState } from "react";
import { MemoryCheck } from "@/components/file/MemoryCheck";
import { effectLabel, memoryCheckReady, type MemoryCheckView, type MemoryEffectKind } from "@/lib/view";

/**
 * What the memory has done across every chat, live from production: how often it changed what the
 * bot did, and the memory check once there's enough to score it.
 */
export function LiveMemoryCheck() {
  const [check, setCheck] = useState<MemoryCheckView | null>(null);
  const [effects, setEffects] = useState<[MemoryEffectKind, number][]>([]);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCheck(d?.memoryCheck ?? null);
        setEffects(Object.entries(d?.memoryEffects ?? {}) as [MemoryEffectKind, number][]);
      })
      .catch(() => setCheck(null));
  }, []);

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
