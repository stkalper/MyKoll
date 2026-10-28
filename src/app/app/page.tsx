"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import { ReceiptCard } from "@/components/ReceiptCard";
import { demoBoard } from "@/lib/demo";
import { hitRate, type BoardView, type Market } from "@/lib/view";

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type Tab = "board" | "calls" | "me";

const markets: { id: Market; label: string }[] = [
  { id: "crypto", label: "Crypto" },
  { id: "cs2", label: "CS2" },
];

/**
 * Telegram Mini App. Opened from a group's /board button it shows that chat (the chat id
 * arrives as start_param); opened anywhere else it shows a demo chat.
 */
export default function MiniApp() {
  const [view, setView] = useState<BoardView | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("board");
  const [market, setMarket] = useState<Market>("crypto");
  const [showHint, setShowHint] = useState(false);
  const [initData, setInitData] = useState("");
  /** The viewer's groups, when the app was opened without one (e.g. from the bot's profile). */
  const [chats, setChats] = useState<{ id: string; title: string }[] | null>(null);

  const openChat = useCallback(async (chat: string, auth: string) => {
    const res = await fetch(`/api/app/board?chat=${encodeURIComponent(chat)}`, {
      headers: { "X-Telegram-Init-Data": auth },
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setError("");
    setView(data);
    try {
      localStorage.setItem("receipts:lastChat", chat);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor("#050505");
      tg.setBackgroundColor("#050505");
    }
    // Outside Telegram there is no signed user, so show the demo chat.
    if (!tg?.initData) return setView(demoBoard);
    setInitData(tg.initData);

    const chat = tg.initDataUnsafe?.start_param;
    if (chat) return openChat(chat, tg.initData);

    const res = await fetch("/api/app/chats", { headers: { "X-Telegram-Init-Data": tg.initData } });
    const list: { id: string; title: string }[] = res.ok ? (await res.json()).chats : [];
    let last: string | null = null;
    try {
      last = localStorage.getItem("receipts:lastChat");
    } catch {}
    const preferred = list.find((c) => c.id === last) ?? (list.length === 1 ? list[0] : null);
    if (preferred) return openChat(preferred.id, tg.initData);
    setChats(list);
  }, [openChat]);

  async function toggleHidden(callId: number, hidden: boolean) {
    if (!view || view.chat.id === "demo") return;
    const res = await fetch("/api/app/hide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData },
      body: JSON.stringify({ chat: view.chat.id, callId, hidden }),
    });
    if (res.ok) await openChat(view.chat.id, initData);
  }

  const isDemo = view?.chat.id === "demo";

  return (
    <main className="glow mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-28">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={() => void load()} />

      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{view ? view.chat.title : "Loading…"}</p>
          <p className="text-sm font-medium">Receipts</p>
        </div>
        {isDemo && <span className="glass rounded-full px-3 py-1 text-xs text-muted">demo</span>}
      </header>

      {error && <p className="glass mt-8 rounded-3xl p-5 text-sm text-muted">{error}</p>}

      {!view && chats && (
        <>
          <h1 className="mt-8 text-4xl font-light leading-tight tracking-tight">
            Pick a <span className="font-semibold">chat.</span>
          </h1>
          <div className="mt-6 space-y-3">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id, initData)}
                className="glass flex w-full items-center justify-between rounded-3xl px-5 py-4 text-left"
              >
                <span className="font-medium">{c.title}</span>
                <span className="text-muted">→</span>
              </button>
            ))}
            {!chats.length && (
              <p className="glass rounded-3xl px-5 py-6 text-sm leading-relaxed text-muted">
                No groups yet. Add @mykoll_bot to a group chat, make a call, then open this again.
              </p>
            )}
          </div>
        </>
      )}

      {view && tab === "board" && (
        <>
          <h1 className="mt-8 text-4xl font-light leading-tight tracking-tight">
            Who called
            <br />
            it <span className="font-semibold">right.</span>
          </h1>
          <div className="mt-6 flex gap-2">
            {markets.map((m) => (
              <button
                key={m.id}
                onClick={() => setMarket(m.id)}
                className={`rounded-full px-5 py-2 text-sm transition-colors ${market === m.id ? "bg-text font-medium text-bg" : "glass text-muted"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ol className="mt-6 space-y-3">
            {view.boards[market].map((s, i) => (
              <li key={s.name} className="glass flex items-center gap-4 rounded-3xl px-5 py-4">
                <span className="w-4 text-sm text-muted">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.hits} of {s.calls} right
                  </p>
                  {s.insight && <p className="mt-1 text-xs text-text/70">{s.insight}</p>}
                </div>
                <span className="text-2xl font-light tabular-nums">{hitRate(s)}%</span>
              </li>
            ))}
            {!view.boards[market].length && (
              <li className="glass rounded-3xl px-5 py-6 text-sm text-muted">No settled {market === "cs2" ? "CS2" : "crypto"} calls yet. Make one in the chat and come back after the deadline.</li>
            )}
          </ol>
        </>
      )}

      {view && tab === "calls" && (
        <>
          <h1 className="mt-8 text-4xl font-light leading-tight tracking-tight">
            Latest <span className="font-semibold">receipts.</span>
          </h1>
          <div className="mt-6 space-y-4">
            {view.recent.map((c) => (
              <ReceiptCard key={c.id} call={c} />
            ))}
            {!view.recent.length && <p className="glass rounded-3xl px-5 py-6 text-sm text-muted">No calls in this chat yet.</p>}
          </div>
        </>
      )}

      {view && tab === "me" && (
        <>
          <h1 className="mt-8 text-4xl font-light leading-tight tracking-tight">
            What I remember
            <br />
            about <span className="font-semibold">you.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Every call you log is kept in this chat&apos;s Walrus Memory. Hide one and it drops off the board, and I stop bringing it up when
            someone asks.
          </p>
          <div className="glass mt-6 rounded-3xl p-5">
            <p className="text-xs tracking-[0.2em] text-muted">WHAT I&apos;VE LEARNED</p>
            {view.learned ? (
              <>
                <p className="mt-3 text-sm leading-relaxed">{view.learned.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {view.learned.strong.map((r) => (
                    <span key={r.segment} className="rounded-full border border-line px-3 py-1 text-xs text-win">
                      ↑ {r.segment} {r.hits}/{r.calls}
                    </span>
                  ))}
                  {view.learned.weak.map((r) => (
                    <span key={r.segment} className="rounded-full border border-line px-3 py-1 text-xs text-loss">
                      ↓ {r.segment} {r.hits}/{r.calls}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted">I bring this up when you make a new call of the same kind.</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing yet. Once a few of your calls settle, I&apos;ll learn where you tend to be right.</p>
            )}
          </div>
          <div className="mt-6 space-y-4">
            {view.mine.map((c) => (
              <ReceiptCard key={c.id} call={c}>
                <button
                  onClick={() => toggleHidden(c.id, !c.hidden)}
                  disabled={isDemo}
                  className="glass mt-4 w-full rounded-full py-2 text-sm text-muted transition-colors hover:text-text"
                >
                  {c.hidden ? "Show again" : "Hide this call"}
                </button>
              </ReceiptCard>
            ))}
            {!view.mine.length && <p className="glass rounded-3xl px-5 py-6 text-sm text-muted">You haven&apos;t made a call here yet.</p>}
          </div>
        </>
      )}

      {showHint && (
        <div className="glass fixed inset-x-4 bottom-24 mx-auto max-w-md rounded-3xl p-5 text-sm">
          <p className="font-medium">Make a call in the chat</p>
          <p className="mt-2 text-muted">/call SOL above $200 by Friday</p>
          <p className="text-muted">/call Spirit beat Vitality tonight</p>
          <p className="mt-2 text-muted">Or just say it — I&apos;ll offer to log it.</p>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-5 mx-auto flex w-full max-w-md items-center justify-between px-4">
        <div className="glass flex gap-1 rounded-full p-1.5">
          {(
            [
              ["board", "⌂ Board"],
              ["calls", "◎ Calls"],
              ["me", "◇ Me"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-sm ${tab === id ? "bg-text font-medium text-bg" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowHint((v) => !v)} className="grid h-12 w-12 place-items-center rounded-full bg-text text-xl text-bg">
          {showHint ? "×" : "+"}
        </button>
      </nav>
    </main>
  );
}
