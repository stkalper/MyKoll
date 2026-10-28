import Link from "next/link";
import { ChatPreview } from "@/components/landing/ChatPreview";
import { LivePrices } from "@/components/landing/LivePrices";
import { ReceiptCard } from "@/components/ReceiptCard";
import { demoCalls } from "@/lib/demo";

const ADD_TO_GROUP = "https://t.me/mykoll_bot?startgroup=receipts";
const GITHUB = "https://github.com/stkalper/MyKoll";

const steps = [
  { title: "Someone makes a call", text: "“SOL to 300 by Friday.” In a message or with /call. The bot asks the author once, or logs it straight away in auto mode." },
  { title: "The bot keeps the receipt", text: "Who said it, the exact words, when, and the price at that second from Tatum. Saved to the chat’s Walrus Memory." },
  { title: "Deadline hits, it posts first", text: "At the deadline the result lands in the chat by itself, with the author’s own reasoning next to it." },
  { title: "Ask it anything later", text: "“What did Ivan say about SUI last month?” It answers from memory, quoting his own words." },
];

const features = [
  { icon: "⚡", title: "Logs calls from plain talk", text: "No commands needed. Ask-first or auto mode, chosen by group admins. Works in English, Ukrainian and more." },
  { icon: "◷", title: "Settles on time, on its own", text: "Each call schedules its own wake-up for the deadline. Crypto settles on price, CS2 on the score the chat confirms." },
  { icon: "💭", title: "Remembers the why", text: "Reply to a receipt to add your reasoning. When the result comes in, everyone sees whether the logic held up." },
  { icon: "◇", title: "Answers from memory", text: "/ask or mention the bot. It recalls calls, results and reasons by meaning, not keywords, in the language you ask." },
  { icon: "🗓", title: "Sunday digest", text: "Sharpest caller, best call and biggest miss of the week, posted to the chat without anyone asking." },
  { icon: "🔗", title: "Receipts you can share", text: "Every result has a public card with a preview image for X. Links are signed and hidden calls stay hidden." },
];

const memoryPoints = [
  {
    title: "The memory is the product",
    text: "Without memory the bot is a price alert. With it, the chat can ask what anyone said, when, and why, and get their own words back.",
  },
  {
    title: "Each chat owns its memory",
    text: "Every group gets its own namespace on Walrus Memory. One chat’s calls never surface in another chat’s answers.",
  },
  {
    title: "You decide what it keeps",
    text: "Only calls are stored, never the whole conversation. Authors can undo an auto-logged message, hide any call, and add or correct the why.",
  },
];

const commands = [
  ["/call SUI to $5 by Friday", "Log a call (or just say it)"],
  ["/why 12 ETF inflows", "Add your reasoning to call #12"],
  ["/ask what did Max say about SOL?", "Answer from the chat’s memory"],
  ["/board", "Who calls it right, with a Mini App"],
  ["/open", "Calls still waiting for their deadline"],
  ["/hide 12", "Take your call off the board and out of answers"],
  ["/mode", "Admins: ask first, or log automatically"],
];

const privacy = [
  "Stores calls, never the rest of the chat.",
  "In ask mode nothing is saved until the author taps “Log it”.",
  "Auto mode is opt-in per group and every logged call can be undone by its author.",
  "Hidden calls drop off the board, the share links and the bot’s answers.",
  "The Mini App only shows a group to people who are in it.",
];

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6">
      <span className="glass rounded-full px-3 py-1 text-xs text-muted">{eyebrow}</span>
      <h2 className="mt-5 max-w-2xl text-3xl font-light leading-tight tracking-tight sm:text-5xl">{title}</h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export default function Landing() {
  return (
    <main className="glow flex-1">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">Receipts</span>
        <div className="flex items-center gap-5 text-sm text-muted">
          <a href="#memory" className="hidden hover:text-text sm:inline">
            Memory
          </a>
          <a href="#prices" className="hidden hover:text-text sm:inline">
            Prices
          </a>
          <a href={GITHUB} className="hidden hover:text-text sm:inline">
            GitHub
          </a>
          <Link href="/app" className="glass rounded-full px-4 py-2 text-text">
            Open demo
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 pb-16 text-center sm:px-6">
        <span className="glass rounded-full px-3 py-1 text-xs text-muted">Telegram bot · Walrus Memory · Tatum</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl">
          Your group chat
          <br />
          finally keeps <span className="font-semibold">receipts.</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted">
          Crypto and CS2 calls get logged, checked when the deadline hits, and remembered. No more &ldquo;I never said that.&rdquo;
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href={ADD_TO_GROUP} className="rounded-full bg-text px-7 py-3 font-medium text-bg transition-opacity hover:opacity-90">
            Add to Telegram
          </a>
          <a href="#how" className="glass rounded-full px-7 py-3">
            How it works
          </a>
        </div>

        <div className="mt-20 flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
          {demoCalls.map((c) => (
            <div key={c.id} className="w-full max-w-sm">
              <ReceiptCard call={c} />
            </div>
          ))}
        </div>
      </section>

      <Section id="how" eyebrow="How it works" title="From a hot take to a receipt in one message.">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((s, i) => (
              <div key={s.title} className="glass rounded-3xl p-6">
                <span className="text-xs text-muted">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
          <ChatPreview />
        </div>
      </Section>

      <Section eyebrow="What it does" title="Built for chats that argue about charts and maps.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-3xl p-6">
              <span className="glass grid h-10 w-10 place-items-center rounded-full">{f.icon}</span>
              <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="memory"
        eyebrow="Walrus Memory"
        title={
          <>
            Why it needs a <span className="font-semibold">memory.</span>
          </>
        }
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            {memoryPoints.map((p) => (
              <div key={p.title} className="glass rounded-3xl p-6">
                <h3 className="text-lg font-medium">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-3xl p-6">
            <p className="text-xs tracking-[0.2em] text-muted">WHAT THE CHAT&apos;S MEMORY HOLDS</p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
              <span className="text-text">[CALL #142]</span> Thursday 30 Oct, 14:02: @ivan called &quot;WAL to 5 cents by Friday&quot;. Logged as WAL above
              $0.0500 by Friday 31 Oct, 23:59. WAL was $0.0341 at the time (on-chain Cetus pool via Tatum Sui RPC).
              {"\n\n"}
              <span className="text-text">[REASON #142]</span> @ivan explained the call: storage usage keeps climbing, chart is coiling
              {"\n\n"}
              <span className="text-text">[RESULT #142]</span> @ivan&apos;s call &quot;WAL to 5 cents by Friday&quot; was WRONG: WAL was $0.0362 at the
              deadline.
            </pre>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              Three plain-language memories per call, sealed on Walrus. Recall works by meaning, so &ldquo;who was bullish on Sui coins?&rdquo; finds
              Ivan&apos;s WAL call without the word &ldquo;bullish&rdquo; anywhere in it.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="prices"
        eyebrow="Tatum"
        title={
          <>
            Prices you can <span className="font-semibold">check.</span>
          </>
        }
      >
        <p className="mb-8 max-w-2xl text-muted">
          Majors come from Tatum&apos;s Price API. Sui tokens like WAL, DEEP and NS aren&apos;t covered there, so the bot reads their price straight
          from the deepest Cetus pool on Sui mainnet through Tatum&apos;s Sui gRPC gateway. Live right now:
        </p>
        <LivePrices />
        <p className="mt-6 text-sm text-muted">
          Every receipt records which source judged it.{" "}
          <a href="/api/health" className="underline underline-offset-4 hover:text-text">
            Live integration status →
          </a>
        </p>
      </Section>

      <Section eyebrow="Mini App" title="The board, one tap from the chat.">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[44px] border border-line bg-bg p-2 shadow-2xl">
            <iframe src="/app" title="Receipts Mini App demo" className="h-[680px] w-full rounded-[36px] bg-bg" loading="lazy" />
          </div>
          <div className="space-y-4">
            {[
              ["Board", "Hit rate per member, split into crypto and CS2."],
              ["Calls", "Every receipt in the chat, with prices, results and reasons."],
              ["Me", "Everything the bot remembers about you in this chat, with a hide switch on each call."],
            ].map(([t, d]) => (
              <div key={t} className="glass rounded-3xl p-6">
                <h3 className="text-lg font-medium">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </div>
            ))}
            <p className="text-sm text-muted">Opened from a group&apos;s /board button. Only members of that group can see it.</p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Commands" title="Everything, in seven commands.">
        <div className="glass divide-y divide-line overflow-hidden rounded-3xl">
          {commands.map(([cmd, what]) => (
            <div key={cmd} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <code className="font-mono text-sm">{cmd}</code>
              <span className="text-sm text-muted">{what}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Privacy" title="It keeps receipts, not your chat.">
        <ul className="grid gap-4 sm:grid-cols-2">
          {privacy.map((p) => (
            <li key={p} className="glass rounded-3xl p-6 text-sm leading-relaxed">
              {p}
            </li>
          ))}
        </ul>
      </Section>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 text-center sm:px-6">
        <h2 className="text-4xl font-light tracking-tight sm:text-6xl">
          Settle it. <span className="font-semibold">Remember it.</span>
        </h2>
        <a href={ADD_TO_GROUP} className="mt-10 inline-block rounded-full bg-text px-8 py-3.5 font-medium text-bg transition-opacity hover:opacity-90">
          Add @mykoll_bot to your group
        </a>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Receipts · built for the Tatum × Walrus Total Recall hackathon</span>
          <div className="flex gap-5">
            <a href={GITHUB} className="hover:text-text">
              GitHub
            </a>
            <a href="/api/health" className="hover:text-text">
              Status
            </a>
            <a href="https://t.me/mykoll_bot" className="hover:text-text">
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
