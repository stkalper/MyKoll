/** A Telegram-style exchange showing one call from message to verdict, written on scraps of paper. */

type Line = {
  from: "user" | "bot";
  name?: string;
  text: string;
  time: string;
  sub?: string;
  button?: string;
};

const lines: Line[] = [
  {
    from: "user",
    name: "Ivan",
    text: "WAL to 5 cents by Friday, calling it",
    time: "14:02",
  },
  {
    from: "bot",
    text: "🧾 Receipt #142 · logged ⚡\nWAL above $0.0500 · by Fri 23:59\nWAL $0.0341 · on-chain via Tatum Sui RPC",
    time: "14:02",
    button: "✗ Not a call",
  },
  {
    from: "user",
    name: "Ivan",
    text: "storage usage keeps climbing, chart is coiling",
    sub: "↩ reply to Receipt #142",
    time: "14:03",
  },
  { from: "bot", text: "🧾 Receipt #142 · why added 💭", time: "14:03" },
  {
    from: "bot",
    text: "🧾 Receipt #142 · ❌ missed\nWAL was $0.0362 at the deadline\n📈 Ivan on Sui tokens: 1/4",
    time: "Fri 23:59",
    button: "🔗 Share this receipt",
  },
  {
    from: "user",
    name: "Max",
    text: "@mykoll_bot how often is Ivan right on Sui coins?",
    time: "Sat 10:12",
  },
  {
    from: "bot",
    text: "1 of 4 on Sui tokens. His WAL call (“5 cents by Friday”) missed at $0.0362, he blamed the chart 😅",
    time: "Sat 10:12",
  },
];

// A slightly different angle for each scrap, so they look torn off by hand.
const tilts = [1.2, -1, 0.8, -1.4, 0.6, 1.1, -0.8];

export function ChatPreview() {
  return (
    <div className="glass mx-auto w-full max-w-md space-y-4 rounded-[32px] p-4 sm:p-5">
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-text text-sm font-semibold text-bg">
          D
        </span>
        <div>
          <p className="text-sm font-medium">Degen Club</p>
          <p className="text-xs text-muted">6 members · MyKoll</p>
        </div>
      </div>
      {lines.map((l, i) => (
        <div
          key={i}
          className={`flex ${l.from === "user" ? "justify-end" : "justify-start"}`}
        >
          {/* The torn mask would clip a shadow on the scrap itself, so the shadow sits on this wrapper. */}
          <div
            className="max-w-[85%] drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]"
            style={{ transform: `rotate(${tilts[i % tilts.length]}deg)` }}
          >
            <div
              className={`ripped px-4 text-ink ${l.from === "user" ? "bg-[#efe3b8]" : "bg-paper"}`}
            >
              {l.name && <p className="field-label">{l.name}</p>}
              {l.sub && (
                <p className="font-mono text-[0.65rem] text-ink-muted">
                  {l.sub}
                </p>
              )}
              <p
                className={`whitespace-pre-line ${l.from === "user" ? "font-hand text-xl leading-tight" : "font-mono text-xs leading-relaxed"}`}
              >
                {l.text}
              </p>
              {l.button && (
                <p className="mt-2 border-2 border-dashed border-rule py-1 text-center font-mono text-[0.65rem] text-ink-muted">
                  {l.button}
                </p>
              )}
              <p className="mt-1 text-right font-mono text-[0.6rem] text-ink-muted">
                {l.time}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
