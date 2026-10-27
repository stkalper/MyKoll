import type { Call } from "@/lib/demo";

const outcomeMark = {
  win: { label: "✓ Called it", className: "text-win" },
  loss: { label: "✗ Missed", className: "text-loss" },
  open: { label: "◷ Open", className: "text-muted" },
} as const;

const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(1)}`;

/** A call rendered as a paper receipt: the shareable unit of the product. */
export function ReceiptCard({ call }: { call: Call }) {
  const mark = outcomeMark[call.outcome];
  return (
    <article className="glass w-full overflow-hidden rounded-[28px] text-left">
      <div className="px-6 pt-6 pb-5">
        <header className="flex items-center justify-between text-xs tracking-[0.2em] text-muted">
          <span>RECEIPT #{call.id}</span>
          <span className={`tracking-normal text-sm font-medium ${mark.className}`}>{mark.label}</span>
        </header>

        <div className="my-4 border-t border-dashed border-line" />

        <p className="text-sm text-muted">
          @{call.author} · {call.madeAt}
        </p>
        <p className="mt-2 text-2xl font-light leading-snug">&ldquo;{call.quote}&rdquo;</p>

        <dl className="mt-5 space-y-2 text-sm">
          {call.entry !== undefined && (
            <>
              <Row label="Then" value={usd(call.entry)} />
              <Row label="Now" value={usd(call.current!)} />
              <Row label="Target" value={usd(call.target!)} />
            </>
          )}
          {call.score && <Row label="Result" value={call.score} />}
          <Row label="Deadline" value={call.deadline} />
        </dl>

        <div className="my-4 border-t border-dashed border-line" />

        <footer className="flex items-center justify-between text-xs text-muted">
          <span>◇ stored on Walrus</span>
          <span>{call.market === "cs2" ? "CS2" : "price via Tatum"}</span>
        </footer>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
