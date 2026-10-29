"use client";

import { useEffect, useState } from "react";
import { MemoryCheck } from "@/components/file/MemoryCheck";
import type { MemoryCheckView } from "@/lib/view";

/** The memory check across every chat, live from production; shown once there's enough to say. */
export function LiveMemoryCheck() {
  const [check, setCheck] = useState<MemoryCheckView | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCheck(d?.memoryCheck ?? null))
      .catch(() => setCheck(null));
  }, []);

  if (!check || check.calls < 5 || check.withRecord < 3) return null;
  return (
    <div className="mb-14 max-w-xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">Live, across every chat</p>
      <MemoryCheck check={check} className="rotate-[0.4deg]" />
    </div>
  );
}
