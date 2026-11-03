import type { LiveStats as Stats } from "@/lib/live";

/** What's on file right now, from production: a slip stuck under the hero. */
export function LiveStats({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  const items: [number, string][] = [
    [stats.groups, stats.groups === 1 ? "group" : "groups"],
    [stats.calls, "calls on file"],
    [stats.settled, "settled"],
    [stats.members, stats.members === 1 ? "member with a record" : "members with a record"],
  ];
  if (stats.memories !== null) items.push([stats.memories, "memories on Walrus mainnet"]);
  const live = stats.publicFiles[0];

  return (
    <div className="mt-8">
      <div className="paper inline-flex max-w-full rotate-[-0.6deg] flex-wrap items-baseline gap-x-5 gap-y-1 rounded-sm px-4 py-2.5">
        <span className="field-label flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-stamp-win" /> Live
        </span>
        {items.map(([n, label]) => (
          <span key={label} className="font-mono text-xs">
            <b className="text-sm tabular-nums">{n}</b> {label}
          </span>
        ))}
      </div>
      {live && (
        <a href={live.url} className="mt-3 block font-mono text-xs text-muted underline decoration-dashed underline-offset-4 hover:text-text">
          Open a real chat&apos;s file, no Telegram needed: {live.title} · {live.calls} calls →
        </a>
      )}
    </div>
  );
}
