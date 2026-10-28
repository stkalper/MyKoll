/** A static Telegram-style exchange showing one call from message to result. */

type Line = { from: "user" | "bot"; name?: string; text: string; time: string; sub?: string; button?: string };

const lines: Line[] = [
  { from: "user", name: "Ivan", text: "WAL to 5 cents by Friday, calling it", time: "14:02" },
  {
    from: "bot",
    text: "🧾 Receipt #142 · logged automatically ⚡\n@ivan: “WAL to 5 cents by Friday”\nWAL above $0.0500 · judged Friday 23:59\nWAL was $0.0341 · on-chain via Tatum Sui RPC",
    time: "14:02",
    button: "✗ Not a call",
  },
  { from: "user", name: "Ivan", text: "storage usage keeps climbing, chart is coiling", sub: "↩ reply to Receipt #142", time: "14:03" },
  { from: "bot", text: "🧾 Receipt #142 · why added 💭", time: "14:03" },
  { from: "bot", text: "🧾 Receipt #142 · ❌ missed\nWAL was $0.0362 at the deadline\n💭 why: storage usage keeps climbing…", time: "Fri 23:59", button: "🔗 Share this receipt" },
  { from: "user", name: "Max", text: "@mykoll_bot how often is Ivan right on Sui coins?", time: "Sat 10:12" },
  { from: "bot", text: "Ivan is 2 for 5 on Sui tokens. His WAL call (“5 cents by Friday”) missed at $0.0362 — he blamed the chart 😅", time: "Sat 10:12" },
];

export function ChatPreview() {
  return (
    <div className="glass mx-auto w-full max-w-md space-y-3 rounded-[32px] p-4 sm:p-5">
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-text text-sm font-semibold text-bg">D</span>
        <div>
          <p className="text-sm font-medium">Degen Club</p>
          <p className="text-xs text-muted">6 members · MyKoll</p>
        </div>
      </div>
      {lines.map((l, i) => (
        <div key={i} className={`flex ${l.from === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${l.from === "user" ? "bg-surface-strong" : "border border-line bg-surface"}`}>
            {l.name && <p className="text-xs font-medium text-muted">{l.name}</p>}
            {l.sub && <p className="text-xs text-muted">{l.sub}</p>}
            <p className="whitespace-pre-line leading-relaxed">{l.text}</p>
            {l.button && <p className="mt-2 rounded-xl border border-line py-1.5 text-center text-xs text-muted">{l.button}</p>}
            <p className="mt-1 text-right text-[10px] text-muted">{l.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
