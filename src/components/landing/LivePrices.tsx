"use client";

import { useEffect, useState } from "react";

interface Price {
  symbol: string;
  price?: number;
  source?: "price-api" | "sui-onchain";
  /** The Sui transaction that set this pool price. */
  proofUrl?: string;
  /** The Price API's price for the same token, when it has one. */
  check?: { price: number; apart: number };
}

const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toPrecision(3)}`);

/** The prices calls are judged by right now, labelled with where each one comes from. */
export function LivePrices() {
  const [prices, setPrices] = useState<Price[] | null>(null);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => setPrices(d.prices))
      .catch(() => setPrices([]));
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {(prices ?? Array.from({ length: 6 }, (_, i): Price => ({ symbol: String(i) }))).map((p) => (
        <div key={p.symbol} className="paper rounded-sm p-4">
          {prices ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-form text-sm font-extrabold uppercase">{p.symbol}</span>
                <span className={`h-2 w-2 rounded-full ${p.price ? "bg-stamp-win" : "bg-ink-muted"}`} />
              </div>
              <p className="mt-2 font-mono text-2xl tabular-nums">{p.price ? fmt(p.price) : "—"}</p>
              <p className="field-label mt-1">{p.source === "sui-onchain" ? "on-chain · Tatum Sui RPC" : "Tatum Price API"}</p>
              {p.check && (
                <p className={`mt-1 font-mono text-[0.65rem] ${p.check.apart > 0.02 ? "text-stamp-loss" : "text-ink-muted"}`}>
                  Price API {fmt(p.check.price)} · {(p.check.apart * 100).toFixed(1)}% apart
                </p>
              )}
              {p.proofUrl && (
                <a href={p.proofUrl} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-[0.65rem] text-ink-muted underline decoration-dotted underline-offset-2">
                  pool tx on Suiscan ↗
                </a>
              )}
            </>
          ) : (
            <div className="h-[96px] animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}
