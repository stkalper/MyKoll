import { Stamp } from "@/components/file/Stamp";
import type { ReceiptView } from "@/lib/view";

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toPrecision(3)}`);

/** A call filed as a form: the statement highlighted, the verdict stamped in the office box. */
export function ReceiptCard({ call, children, tilt = 0 }: { call: ReceiptView; children?: React.ReactNode; tilt?: number }) {
  const source = call.market === "cs2" ? "score confirmed in chat" : call.priceSource === "sui-onchain" ? "on-chain via Tatum Sui RPC" : "Tatum Price API";
  return (
    <article
      className={`paper torn relative w-full rounded-sm px-5 pt-5 text-left ${call.hidden ? "opacity-50" : ""}`}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      <header className="flex items-start justify-between gap-3 border-b-2 border-ink pb-2">
        <div>
          <p className="font-form text-[0.8rem] font-extrabold uppercase tracking-[0.08em]">Department of Receipts</p>
          <p className="field-label">Form RC-1 · call record</p>
        </div>
        <span className="shrink-0 border-2 border-ink px-2 py-0.5 font-mono text-xs font-semibold">CASE #{call.id}</span>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="field px-2.5 py-1.5">
          <p className="field-label">Called by</p>
          <p className="font-mono text-sm font-semibold">{call.author}</p>
        </div>
        <div className="field px-2.5 py-1.5">
          <p className="field-label">Filed</p>
          <p className="font-mono text-xs">{call.madeAt}</p>
        </div>
      </div>

      <div className="field mt-2 px-2.5 py-2">
        <p className="field-label">Statement</p>
        <p className="mt-1 font-mono text-[0.95rem] leading-relaxed">
          <span className="hl">{call.quote}</span>
        </p>
      </div>

      <dl className="field mt-2 divide-y divide-rule/60 font-mono text-xs">
        <Row label="Call" value={call.claim} />
        {call.entry !== undefined && <Row label="Price then" value={usd(call.entry)} />}
        {call.final !== undefined && <Row label="At result" value={usd(call.final)} />}
        <Row label="Deadline" value={call.deadline} />
      </dl>

      {call.reasons?.map((r) => (
        <p key={r} className="mt-2 font-hand text-xl leading-tight text-ink-muted">
          why: {r}
        </p>
      ))}

      <div className="mt-3 flex min-h-[84px] items-center justify-between gap-3 border-2 border-dashed border-rule px-3 py-2">
        <div>
          <p className="field-label">For office use only</p>
          {call.note && <p className="mt-1 max-w-[16rem] font-mono text-[0.7rem] leading-snug text-ink-muted">{call.note}</p>}
        </div>
        <Stamp outcome={call.outcome} />
      </div>

      <footer className="mt-2 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-wider text-ink-muted">
        <span>◇ filed on Walrus</span>
        <span>{source}</span>
      </footer>
      {children}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-2.5 py-1.5">
      <dt className="field-label self-center">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
