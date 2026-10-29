"use client";

import { useEffect, useState } from "react";

interface Stats {
  groups: number;
  calls: number;
  settled: number;
  members: number;
  memories: number | null;
}

/** What's on file right now, live from production: a slip stuck under the hero. */
export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;
  const items: [number, string][] = [
    [stats.groups, stats.groups === 1 ? "group" : "groups"],
    [stats.calls, "calls on file"],
    [stats.settled, "settled"],
    [stats.members, stats.members === 1 ? "member with a record" : "members with a record"],
  ];
  if (stats.memories !== null) items.push([stats.memories, "memories on Walrus mainnet"]);

  return (
    <div className="paper mt-8 inline-flex max-w-full rotate-[-0.6deg] flex-wrap items-baseline gap-x-5 gap-y-1 rounded-sm px-4 py-2.5">
      <span className="field-label flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-stamp-win" /> Live
      </span>
      {items.map(([n, label]) => (
        <span key={label} className="font-mono text-xs">
          <b className="text-sm tabular-nums">{n}</b> {label}
        </span>
      ))}
    </div>
  );
}
