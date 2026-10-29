import { Stamp } from "@/components/file/Stamp";
import { PenTail } from "@/components/landing/PenTail";
import type { ReceiptView } from "@/lib/view";

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toPrecision(3)}`);

/** A call as a torn-off slip: the words highlighted, what it means, and the verdict stamped on. */
export function ReceiptCard({
  call,
  children,
  tilt = 0,
  penWrite = false,
}: {
  call: ReceiptView;
  children?: React.ReactNode;
  tilt?: number;
  /** Let the landing page's pen finish writing the first reason. */
  penWrite?: boolean;
}) {
  const source =
    call.market === "cs2"
      ? "score confirmed in chat"
      : call.priceSource === "sui-onchain"
        ? "on-chain · Tatum Sui RPC"
        : call.priceSource === "robinhood-onchain"
          ? "Robinhood Chain · Tatum RPC"
          : "Tatum Price API";
  const price = call.entry !== undefined ? `${usd(call.entry)} → ${call.final !== undefined ? usd(call.final) : "…"}` : null;
  return (
    <article
      className={`paper torn relative w-full rounded-sm px-5 pt-4 text-left ${call.hidden ? "opacity-50" : ""}`}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      <header className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
        <span className="font-form text-xs font-extrabold uppercase tracking-[0.1em]">Receipt #{call.id}</span>
        <span className="truncate font-mono text-xs text-ink-muted">
          {call.author} · {call.madeAt.split(",")[0]}
        </span>
      </header>

      <p className="mt-4 font-mono text-lg leading-relaxed">
        <span className="hl">{call.quote}</span>
      </p>

      <p className="mt-3 font-mono text-xs text-ink-muted">
        {call.claim} · by {call.deadline}
        {price && <span className="block">{price}</span>}
        {call.check && (
          <span className={`block ${call.check.apart > 0.02 ? "text-stamp-loss" : ""}`}>
            Price API {call.check.apart > 0.02 ? "disagrees" : "agrees"}: {usd(call.check.price)} ({(call.check.apart * 100).toFixed(1)}% apart)
          </span>
        )}
        {call.proofUrl && (
          <a href={call.proofUrl} target="_blank" rel="noreferrer" className="block underline decoration-dotted underline-offset-2">
            check the price on {call.proofChain ?? "Sui"} ↗
          </a>
        )}
      </p>

      {call.reasons?.map((r, i) => (
        <p key={r} className="mt-2 font-hand text-xl leading-tight text-ink-muted">
          why: {penWrite && i === 0 ? <PenTail text={r} /> : r}
        </p>
      ))}

      <div className="mt-4 flex items-end justify-between gap-3 border-t-2 border-dashed border-rule pt-3">
        <span className="field-label max-w-[10rem]">{source}</span>
        <Stamp outcome={call.outcome} />
      </div>
      {children}
    </article>
  );
}

/** Something stuck to the desk with a strip of tape. */
export function Taped({ children, tilt = 0, tapeTilt = -4, className = "" }: { children: React.ReactNode; tilt?: number; tapeTilt?: number; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
      <span className="tape -top-3 left-1/2 z-10 -translate-x-1/2" style={{ rotate: `${tapeTilt}deg` }} />
      {children}
    </div>
  );
}
