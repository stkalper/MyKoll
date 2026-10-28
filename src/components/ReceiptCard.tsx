import type { ReceiptView } from "@/lib/view";

const outcomeMark = {
  win: { label: "✓ Called it", className: "text-win" },
  loss: { label: "✗ Missed", className: "text-loss" },
  open: { label: "◷ Open", className: "text-muted" },
  void: { label: "— Void", className: "text-muted" },
} as const;

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toPrecision(3)}`);

/** A call rendered as a paper receipt: the shareable unit of the product. */
export function ReceiptCard({ call, children }: { call: ReceiptView; children?: React.ReactNode }) {
  const mark = outcomeMark[call.outcome];
  return (
    <article className={`glass w-full overflow-hidden rounded-[28px] text-left ${call.hidden ? "opacity-50" : ""}`}>
      <div className="px-6 pt-6 pb-5">
        <header className="flex items-center justify-between text-xs tracking-[0.2em] text-muted">
          <span>RECEIPT #{call.id}</span>
          <span className={`tracking-normal text-sm font-medium ${mark.className}`}>{mark.label}</span>
        </header>

        <div className="my-4 border-t border-dashed border-line" />

        <p className="text-sm text-muted">
          {call.author} · {call.madeAt}
        </p>
        <p className="mt-2 text-2xl font-light leading-snug">&ldquo;{call.quote}&rdquo;</p>

        <dl className="mt-5 space-y-2 text-sm">
          <Row label="Call" value={call.claim} />
          {call.entry !== undefined && <Row label="Then" value={usd(call.entry)} />}
          {call.final !== undefined && <Row label="At result" value={usd(call.final)} />}
          <Row label="Deadline" value={call.deadline} />
        </dl>
        {call.note && <p className="mt-3 text-sm text-muted">{call.note}</p>}
        {call.reasons?.map((r) => (
          <p key={r} className="mt-3 text-sm leading-relaxed">
            <span className="text-muted">Why · </span>
            {r}
          </p>
        ))}

        <div className="my-4 border-t border-dashed border-line" />

        <footer className="flex items-center justify-between text-xs text-muted">
          <span>◇ stored on Walrus</span>
          <span>{call.market === "cs2" ? "CS2" : "price via Tatum"}</span>
        </footer>
        {children}
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
