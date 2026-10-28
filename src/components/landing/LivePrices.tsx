"use client";

import { useEffect, useState } from "react";

interface Price {
  symbol: string;
  price?: number;
  source?: "price-api" | "sui-onchain";
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
        <div key={p.symbol} className="glass rounded-3xl p-5">
          {prices ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.symbol}</span>
                <span className={`h-2 w-2 rounded-full ${p.price ? "bg-win" : "bg-muted"}`} />
              </div>
              <p className="mt-3 text-2xl font-light tabular-nums">{p.price ? fmt(p.price) : "—"}</p>
              <p className="mt-1 text-xs text-muted">{p.source === "sui-onchain" ? "on-chain · Tatum Sui RPC" : "Tatum Price API"}</p>
            </>
          ) : (
            <div className="h-[76px] animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}
