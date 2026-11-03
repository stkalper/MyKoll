"use client";

import { useEffect, useState } from "react";

const GITHUB = "https://github.com/stkalper/MyKoll";
/** The demo video, once it's up. */
const VIDEO = "";

/**
 * Where a judge can see the bot at work without joining a Telegram group: a real chat's public
 * file (if an admin opened one), the README's check-it-yourself table, and the live endpoints.
 */
export function JudgePath() {
  const [file, setFile] = useState<{ title: string; calls: number; url: string } | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setFile(s?.publicFiles?.[0] ?? null))
      .catch(() => setFile(null));
  }, []);

  const items = [
    file
      ? { label: "A real chat, live", title: file.title, text: `${file.calls} calls as they were made, priced and settled, with what memory changed there. No Telegram needed.`, href: file.url }
      : { label: "The Mini App", title: "Demo chat", text: "The board, receipts and member files, on a sample chat. No Telegram needed.", href: "/app" },
    { label: "Every claim", title: "Check it yourself", text: "Each claim in the README links to a receipt, a Walrus blob, a Sui transaction or a Polymarket market.", href: `${GITHUB}#check-it-yourself` },
    { label: "Live", title: "/api/health", text: "Reads every price source, Polymarket and Walrus Memory right now, and says when a public fallback is in use.", href: "/api/health" },
    { label: "Live", title: "/api/stats", text: "Groups, calls, memories on Walrus mainnet, what memory changed, and the raw memory score.", href: "/api/stats" },
    ...(VIDEO ? [{ label: "2 minutes", title: "Demo video", text: "From a hot take in the chat to a verdict, a recall and a learned record.", href: VIDEO }] : []),
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it, i) => (
        <a
          key={it.title}
          href={it.href}
          className="paper block rounded-sm p-5 transition-transform hover:-translate-y-0.5"
          style={{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}
        >
          <p className="field-label">{it.label}</p>
          <h3 className="mt-1 border-b-2 border-ink pb-2 font-form text-base font-extrabold uppercase tracking-wide">{it.title} →</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink">{it.text}</p>
        </a>
      ))}
    </div>
  );
}
