"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import { MemberBadge } from "@/components/file/MemberBadge";
import { MemoryCheck } from "@/components/file/MemoryCheck";
import { Tally } from "@/components/file/Tally";
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
      tg.setHeaderColor("#0b0e15");
      tg.setBackgroundColor("#0b0e15");
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

  const settledCount = view ? view.boards.crypto.reduce((n, s) => n + s.calls, 0) + view.boards.cs2.reduce((n, s) => n + s.calls, 0) : 0;

  return (
    <main className="glow mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-28">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={() => void load()} />

      <header className="flex items-start justify-between">
        <div>
          <p className="font-form text-sm font-extrabold uppercase tracking-[0.08em]">MyKoll</p>
          <p className="font-mono text-xs text-muted">{view ? `chat file · ${view.chat.title}` : "opening the file…"}</p>
        </div>
        {isDemo ? (
          <span className="stamp text-[0.65rem] text-loss">demo</span>
        ) : (
          view && (
            <span className="text-muted">
              <Tally count={Math.min(settledCount, 25)} />
            </span>
          )
        )}
      </header>

      {error && <p className="paper mt-8 rounded-sm p-5 font-mono text-sm">{error}</p>}

      {!view && chats && (
        <>
          <Title>Pick a file.</Title>
          <div className="mt-6 space-y-3">
            {chats.map((c) => (
              <button key={c.id} onClick={() => openChat(c.id, initData)} className="paper flex w-full items-center justify-between rounded-sm px-5 py-4 text-left">
                <span>
                  <span className="field-label block">Chat file</span>
                  <span className="font-mono font-semibold">{c.title}</span>
                </span>
                <span className="font-mono">→</span>
              </button>
            ))}
            {!chats.length && (
              <p className="paper rounded-sm px-5 py-6 font-mono text-sm leading-relaxed">
                No files yet. Add @mykoll_bot to a group chat, make a call, then open this again.
              </p>
            )}
          </div>
        </>
      )}

      {view && tab === "board" && (
        <>
          <Title>Who called it right.</Title>
          <div className="mt-6 flex gap-2">
            {markets.map((m) => (
              <button
                key={m.id}
                onClick={() => setMarket(m.id)}
                className={`rounded-t-lg border-2 border-b-0 px-5 pt-2 pb-1.5 font-form text-xs font-extrabold uppercase tracking-wider ${
                  market === m.id ? "border-outline bg-folder text-ink" : "border-line text-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ol className="folder -mt-[2px] space-y-3 rounded-b-2xl rounded-tr-2xl p-3">
            {view.boards[market].map((s, i) => (
              <li key={s.name} className="paper flex items-center gap-3 rounded-sm px-4 py-3" style={{ transform: `rotate(${i % 2 ? 0.5 : -0.5}deg)` }}>
                <span className="font-form text-lg font-extrabold text-ink-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono font-semibold">{s.name}</p>
                  <p className="field-label">
                    {s.hits} of {s.calls} right
                  </p>
                  {s.insight && <p className="mt-1 truncate font-hand text-lg leading-none text-ink-muted">{s.insight}</p>}
                </div>
                <span className={`font-mono text-2xl font-semibold tabular-nums ${hitRate(s) >= 50 ? "text-stamp-win" : "text-stamp-loss"}`}>{hitRate(s)}%</span>
              </li>
            ))}
            {!view.boards[market].length && (
              <li className="paper rounded-sm px-4 py-5 font-mono text-sm">
                No settled {market === "cs2" ? "CS2" : "crypto"} calls yet. Make one in the chat and come back after the deadline.
              </li>
            )}
          </ol>
          {view.memoryCheck && <MemoryCheck check={view.memoryCheck} className="mt-6 rotate-[-0.4deg]" />}
        </>
      )}

      {view && tab === "calls" && (
        <>
          <Title>Latest filings.</Title>
          <div className="mt-6 space-y-6">
            {view.recent.map((c, i) => (
              <ReceiptCard key={c.id} call={c} tilt={i % 2 ? 0.6 : -0.6} />
            ))}
            {!view.recent.length && <p className="paper rounded-sm px-5 py-6 font-mono text-sm">No calls in this chat yet.</p>}
          </div>
        </>
      )}

      {view && tab === "me" && (
        <>
          <Title>Your file.</Title>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every call you make is filed in this chat&apos;s Walrus Memory. Hide one and it drops off the board, and I stop bringing it up.
          </p>
          <div className="mt-8 flex justify-center">
            {view.learned ? (
              <MemberBadge
                name={view.learned.name}
                hits={view.learned.hits}
                calls={view.learned.calls}
                strong={view.learned.strong.map((r) => `${r.segment} ${r.hits}/${r.calls}`)}
                weak={view.learned.weak.map((r) => `${r.segment} ${r.hits}/${r.calls}`)}
                className="-rotate-2"
              />
            ) : (
              <p className="paper rounded-sm px-5 py-5 font-mono text-sm">No record yet. Once a few of your calls settle, I&apos;ll learn where you tend to be right.</p>
            )}
          </div>
          {view.learned && (
            <p className="mt-4 text-center font-hand text-xl text-muted">I bring this up when you make a new call of the same kind.</p>
          )}
          {view.habits && (view.habits.habit || view.habits.misreads > 0) && (
            <div className="paper mt-6 rotate-[0.6deg] rounded-sm px-5 py-4">
              <p className="field-label">How I handle your calls</p>
              {view.habits.habit && <p className="mt-2 font-mono text-sm">{view.habits.habit}</p>}
              {view.habits.misreads > 0 && (
                <p className="mt-2 font-hand text-xl text-ink-muted">
                  You told me {view.habits.misreads === 1 ? "once" : `${view.habits.misreads} times`} that I misread you. I ask less about calls like those.
                </p>
              )}
            </div>
          )}
          <div className="mt-8 space-y-6">
            {view.mine.map((c) => (
              <ReceiptCard key={c.id} call={c}>
                <button
                  onClick={() => toggleHidden(c.id, !c.hidden)}
                  disabled={isDemo}
                  className="mt-3 w-full rounded-sm border-2 border-ink py-2 font-form text-xs font-extrabold uppercase tracking-wider"
                >
                  {c.hidden ? "Unhide this call" : "Hide this call"}
                </button>
              </ReceiptCard>
            ))}
            {!view.mine.length && <p className="paper rounded-sm px-5 py-6 font-mono text-sm">You haven&apos;t made a call here yet.</p>}
          </div>
        </>
      )}

      {showHint && (
        <div className="paper fixed inset-x-4 bottom-24 mx-auto max-w-md rotate-[-1deg] rounded-sm p-5">
          <p className="field-label">How to file a call</p>
          <p className="mt-2 font-mono text-sm">/call SOL above $200 by Friday</p>
          <p className="font-mono text-sm">/call Spirit beat Vitality tonight</p>
          <p className="mt-2 font-hand text-xl text-ink-muted">or just say it in the chat, I&apos;ll offer to log it</p>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-5 mx-auto flex w-full max-w-md items-center justify-between px-4">
        <div className="flex gap-1 rounded-lg border-2 border-outline bg-paper p-1 shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
          {(
            [
              ["board", "Board"],
              ["calls", "Calls"],
              ["me", "My file"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-4 py-2 font-form text-xs font-extrabold uppercase tracking-wider ${tab === id ? "bg-ink text-paper" : "text-ink-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowHint((v) => !v)}
          className="grid h-12 w-12 place-items-center rounded-lg border-2 border-outline text-xl font-bold text-ink shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
          style={{ background: "var(--hl)" }}
        >
          {showHint ? "×" : "+"}
        </button>
      </nav>
    </main>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-8 font-form text-4xl font-extrabold uppercase leading-[0.95] tracking-tight">{children}</h1>;
}
