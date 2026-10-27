"use client";

import { useState } from "react";
import { ReceiptCard } from "@/components/ReceiptCard";
import { calls, hitRate, members, type Market } from "@/lib/demo";

const tabs: { id: Market; label: string }[] = [
  { id: "crypto", label: "Crypto" },
  { id: "cs2", label: "CS2" },
];

/** Telegram Mini App home: the chat's leaderboard and latest receipts. */
export default function MiniAppHome() {
  const [market, setMarket] = useState<Market>("crypto");
  const ranked = [...members[market]].sort((a, b) => hitRate(b) - hitRate(a));
  const latest = calls.filter((c) => c.market === market);

  return (
    <main className="glow mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-28">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Degen Club · 6 members</p>
          <p className="text-sm font-medium">Receipts</p>
        </div>
        <span className="glass grid h-10 w-10 place-items-center rounded-full text-sm">☰</span>
      </header>

      <h1 className="mt-8 text-4xl font-light leading-tight tracking-tight">
        Who called
        <br />
        it <span className="font-semibold">right.</span>
      </h1>

      <div className="mt-6 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMarket(t.id)}
            className={`rounded-full px-5 py-2 text-sm transition-colors ${
              market === t.id ? "bg-text text-bg font-medium" : "glass text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ol className="mt-6 space-y-3">
        {ranked.map((m, i) => (
          <li key={m.handle} className="glass flex items-center gap-4 rounded-3xl px-5 py-4">
            <span className="w-4 text-sm text-muted">{i + 1}</span>
            <div className="flex-1">
              <p className="font-medium">@{m.handle}</p>
              <p className="text-xs text-muted">
                {m.calls} calls{m.streak > 1 ? ` · 🔥 ${m.streak} in a row` : ""}
              </p>
            </div>
            <span className="text-2xl font-light tabular-nums">{hitRate(m)}%</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-sm text-muted">Latest receipts</h2>
      <div className="mt-3 space-y-4">
        {latest.map((c) => (
          <ReceiptCard key={c.id} call={c} />
        ))}
      </div>

      <nav className="fixed inset-x-0 bottom-5 mx-auto flex w-full max-w-md items-center justify-between px-4">
        <div className="glass flex gap-1 rounded-full p-1.5">
          <span className="rounded-full bg-text px-4 py-2 text-sm font-medium text-bg">⌂ Board</span>
          <span className="px-4 py-2 text-sm text-muted">◎ Calls</span>
          <span className="px-4 py-2 text-sm text-muted">◇ Memory</span>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-text text-xl text-bg">+</span>
      </nav>
    </main>
  );
}
