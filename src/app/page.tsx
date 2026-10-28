import Link from "next/link";
import { ReceiptCard } from "@/components/ReceiptCard";
import { demoCalls } from "@/lib/demo";

const steps = [
  { title: "Someone makes a call", text: "“SOL to 300 by Friday.” The bot asks once if it should log it. Nothing is saved without a tap." },
  { title: "The bot keeps the receipt", text: "Who said it, when, the price at that moment from Tatum, and the exact words in Walrus Memory." },
  { title: "Deadline hits, it posts first", text: "The result lands in the chat by itself. For CS2 the chat confirms the score." },
  { title: "Ask it anything later", text: "“What did Ivan say about SUI last month?” It answers with his own quote." },
];

export default function Landing() {
  return (
    <main className="glow flex-1">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">Receipts</span>
        <Link href="/app" className="glass rounded-full px-4 py-2 text-sm">
          Open demo
        </Link>
      </nav>

      <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 pb-24 text-center sm:px-6">
        <span className="glass rounded-full px-3 py-1 text-xs text-muted">Telegram bot · Walrus Memory · Tatum</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl">
          Your group chat
          <br />
          finally keeps <span className="font-semibold">receipts.</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted">
          Crypto and CS2 calls get logged, checked when the deadline hits, and remembered. No more &ldquo;I never said
          that.&rdquo;
        </p>
        <a
          href="https://t.me/mykoll_bot?startgroup=receipts"
          className="mt-10 rounded-full bg-text px-7 py-3 font-medium text-bg transition-opacity hover:opacity-90"
        >
          Add to Telegram
        </a>

        <div className="mt-20 flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
          {demoCalls.map((c) => (
            <div key={c.id} className="w-full max-w-sm">
              <ReceiptCard call={c} />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
        <h2 className="text-center text-3xl font-light tracking-tight sm:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="glass rounded-3xl p-6">
              <span className="text-xs text-muted">0{i + 1}</span>
              <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
