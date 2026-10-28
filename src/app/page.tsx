import Link from "next/link";
import { MemberBadge } from "@/components/file/MemberBadge";
import { ChatPreview } from "@/components/landing/ChatPreview";
import { LivePrices } from "@/components/landing/LivePrices";
import { PenTail } from "@/components/landing/PenTail";
import { ScrollPen } from "@/components/landing/ScrollPen";
import { ReceiptCard, Taped } from "@/components/ReceiptCard";
import { demoCalls } from "@/lib/demo";

const ADD_TO_GROUP = "https://t.me/mykoll_bot?startgroup=receipts";
const GITHUB = "https://github.com/stkalper/MyKoll";

const steps = [
  {
    title: "Someone makes a call",
    text: "“SOL to 300 by Friday.” In a message or with /call. The bot asks the author once, or logs it straight away in auto mode.",
  },
  {
    title: "The bot files the receipt",
    text: "Who said it, the exact words, when, and the price at that second from Tatum. Saved to the chat’s Walrus Memory.",
  },
  {
    title: "Deadline hits, it posts first",
    text: "At the deadline the verdict lands in the chat by itself, with the author’s own reasoning next to it.",
  },
  {
    title: "It learns who to trust",
    text: "Every verdict updates the author’s record. Their next call is met with it, and with their most similar past call.",
  },
];

const features = [
  {
    title: "Logs calls from plain talk",
    text: "No commands needed. Ask-first or auto mode, chosen by group admins. Works in English, Ukrainian and more.",
  },
  {
    title: "Settles on time, on its own",
    text: "Each call schedules its own wake-up for the deadline. Crypto settles on price, CS2 on the score the chat confirms.",
  },
  {
    title: "Remembers the why",
    text: "Reply to a receipt to add your reasoning. When the verdict comes in, everyone sees whether the logic held up.",
  },
  {
    title: "Answers from memory",
    text: "/ask or mention the bot. It recalls calls, verdicts and reasons by meaning, in the language you ask.",
  },
  {
    title: "Sunday digest",
    text: "Sharpest caller, best call and biggest miss of the week, posted to the chat without anyone asking.",
  },
  {
    title: "Receipts you can share",
    text: "Every verdict has a public card with a preview for X. Links are signed and hidden calls stay hidden.",
  },
];

const memoryEntries = [
  {
    tag: "CALL",
    color: "border-stamp-open text-stamp-open",
    text: "@ivan called “WAL to 5 cents by Friday”. WAL above $0.0500 by Fri 23:59. WAL was $0.0341 (on-chain via Tatum Sui RPC).",
  },
  {
    tag: "REASON",
    color: "border-ink-muted text-ink-muted",
    text: "@ivan explained the call: storage usage keeps climbing, chart is coiling.",
  },
  {
    tag: "RESULT",
    color: "border-stamp-loss text-stamp-loss",
    text: "@ivan’s call “WAL to 5 cents by Friday” was WRONG: WAL was $0.0362 at the deadline.",
  },
  {
    tag: "TRACK RECORD",
    color: "border-stamp-win text-stamp-win",
    text: "@ivan is 13/18 right; strong on majors 9/10; weak on Sui tokens 1/4.",
  },
];

const memoryPoints = [
  {
    title: "The memory is the product",
    text: "Without memory the bot is a price alert. With it, the chat can ask what anyone said, when, and why, and get their own words back.",
  },
  {
    title: "It changes what the bot does",
    text: "Every verdict rewrites the author’s track record. New calls come back with that record and the most similar past call, recalled by meaning.",
  },
  {
    title: "Each chat owns its file",
    text: "Every group gets its own namespace on Walrus Memory. One chat’s calls never surface in another chat’s answers.",
  },
  {
    title: "You decide what it keeps",
    text: "Only calls are stored, never the conversation. Authors can undo an auto-logged message, hide any call, and add the why.",
  },
];

const commands = [
  ["/call SUI to $5 by Friday", "Log a call (or just say it)"],
  ["/why 12 ETF inflows", "Add your reasoning to call #12"],
  ["/ask who should I trust on CS2?", "Answer from the chat’s memory"],
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

/** A folder-tab label over each section. */
function Tab({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-t-lg border-2 border-b-0 border-outline bg-folder px-4 pt-1.5 pb-1 font-form text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-ink">
      {children}
    </span>
  );
}

function Section({
  id,
  tab,
  title,
  children,
}: {
  id?: string;
  tab: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6"
    >
      <Tab>{tab}</Tab>
      <h2 className="mt-5 max-w-2xl font-form text-3xl font-extrabold uppercase leading-tight tracking-tight sm:text-5xl">
        {title}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

/** A sheet of paper with a small form header. */
function Sheet({
  label,
  title,
  children,
  tilt = 0,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  tilt?: number;
}) {
  return (
    <div
      className="paper rounded-sm p-5"
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      <p className="field-label">{label}</p>
      <h3 className="mt-1 border-b-2 border-ink pb-2 font-form text-base font-extrabold uppercase tracking-wide">
        {title}
      </h3>
      <div className="mt-3 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

export default function Landing() {
  return (
    <main className="glow relative isolate flex-1">
      <ScrollPen />
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="font-form text-lg font-extrabold uppercase tracking-[0.06em]">
          Receipts
        </span>
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
          <Link
            href="/app"
            className="rounded-md border-2 border-outline bg-paper px-4 py-1.5 font-form text-xs font-extrabold uppercase tracking-wider text-ink shadow-[3px_3px_0_rgba(0,0,0,0.5)]"
          >
            Open demo
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Telegram bot · Walrus Memory · Tatum
        </p>
        <h1 className="mt-5 max-w-4xl font-form text-5xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-7xl">
          Your group chat finally keeps{" "}
          <span className="hl text-ink">receipts.</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted">
          Crypto and CS2 calls get filed, judged when the deadline hits, and
          remembered. The bot learns who in your chat is worth listening to.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={ADD_TO_GROUP}
            className="rounded-md border-2 border-outline px-6 py-3 font-form text-sm font-extrabold uppercase tracking-wider text-ink shadow-[4px_4px_0_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--hl)" }}
          >
            Add to Telegram
          </a>
          <a
            href="#how"
            className="rounded-md border-2 border-line px-6 py-3 font-form text-sm font-bold uppercase tracking-wider"
          >
            How it works
          </a>
        </div>

        {/* Receipts taped straight onto the desk. The pen's route starts at the first one. */}
        <div className="mt-16 grid items-start gap-10 md:grid-cols-3">
          {demoCalls.map((c, i) => (
            <Taped
              key={c.id}
              tilt={[-2, 1.5, -1][i % 3]}
              tapeTilt={[-5, 4, -2][i % 3]}
              className={["", "md:mt-10", "md:mt-4"][i % 3]}
            >
              <ReceiptCard call={c} penWrite={i === 0} />
            </Taped>
          ))}
        </div>
      </section>

      <Section
        id="how"
        tab="How it works"
        title="From a hot take to a verdict."
      >
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {steps.map((s, i) => (
              <Sheet
                key={s.title}
                label={`Step 0${i + 1}`}
                title={s.title}
                tilt={i % 2 ? 0.8 : -0.8}
              >
                {s.text}
              </Sheet>
            ))}
          </div>
          <div data-pen="2" data-pen-points="0.25,0.03;0.6,0.5;0.25,0.98">
            <ChatPreview />
          </div>
        </div>
      </Section>

      <Section
        tab="What it does"
        title="Built for chats that argue about charts and maps."
      >
        <div data-pen="3" data-pen-points="0.15,0.3;0.7,0.85" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Sheet
              key={f.title}
              label={`Section ${String.fromCharCode(65 + i)}`}
              title={f.title}
            >
              {f.text}
            </Sheet>
          ))}
        </div>
      </Section>

      <Section id="memory" tab="Walrus Memory" title="Why it needs a memory.">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {memoryPoints.map((p) => (
              <Sheet key={p.title} label="Finding" title={p.title}>
                {p.text}
              </Sheet>
            ))}
          </div>
          <div className="flex flex-col gap-12">
            <Taped tilt={0.8} tapeTilt={3}>
              <div className="paper torn rounded-sm p-5">
                <div className="flex items-start justify-between border-b-2 border-ink pb-2">
                  <div>
                    <p className="font-form text-[0.8rem] font-extrabold uppercase tracking-[0.08em]">
                      Evidence log · case #142
                    </p>
                    <p className="field-label">
                      What the chat&apos;s Walrus Memory holds
                    </p>
                  </div>
                  <span className="border-2 border-ink px-2 py-0.5 font-mono text-[0.65rem] font-semibold">
                    NAMESPACE receipts:chat
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {memoryEntries.map((m) => (
                    <li
                      key={m.tag}
                      className="field flex items-start gap-3 px-3 py-2"
                    >
                      <span
                        className={`mt-0.5 shrink-0 border-2 px-1.5 font-mono text-[0.6rem] font-semibold ${m.color}`}
                      >
                        {m.tag}
                      </span>
                      <span className="font-mono text-xs leading-relaxed">
                        {m.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-hand text-xl leading-snug text-ink-muted">
                  <PenTail text="“who was bullish on Sui coins?” finds Ivan's WAL call, though the word “bullish” is nowhere in it." />
                </p>
              </div>
            </Taped>
            {/* What the bot learned about Ivan from those verdicts: the badge it holds up on his next call. */}
            <MemberBadge
              data-pen="4"
              name="@ivan"
              hits={13}
              calls={18}
              strong={["majors 9/10"]}
              weak={["Sui tokens 1/4"]}
              className="mx-auto -rotate-3"
            />
          </div>
        </div>
      </Section>

      <Section id="prices" tab="Tatum" title="Prices you can check.">
        <p className="mb-8 max-w-2xl text-muted">
          Majors come from Tatum&apos;s Price API. Sui tokens like WAL, DEEP and
          NS aren&apos;t covered there, so the bot reads their price straight
          from the deepest Cetus pool on Sui mainnet through Tatum&apos;s Sui
          gRPC gateway. Live right now:
        </p>
        <div data-pen="5" data-pen-points="0.12,0.5">
          <LivePrices />
        </div>
        <p className="mt-6 text-sm text-muted">
          Every receipt records which source judged it.{" "}
          <a
            href="/api/health"
            className="underline underline-offset-4 hover:text-text"
          >
            Live integration status →
          </a>
        </p>
      </Section>

      <Section tab="Mini App" title="The board, one tap from the chat.">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div
            data-pen="6"
            data-pen-points="0.95,0.35"
            className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[44px] border-2 border-outline bg-bg p-2 shadow-[6px_8px_0_rgba(0,0,0,0.5)]"
          >
            <iframe
              src="/app"
              title="Receipts Mini App demo"
              className="h-[680px] w-full rounded-[36px] bg-bg"
              loading="lazy"
            />
          </div>
          <div className="space-y-5">
            <Sheet label="Tab 1" title="Board">
              Hit rate per member, split into crypto and CS2, with what the bot
              has learned about each of them.
            </Sheet>
            <Sheet label="Tab 2" title="Calls">
              Every filed call in the chat, with prices, verdicts and reasons.
            </Sheet>
            <Sheet label="Tab 3" title="Your file">
              Everything the bot remembers about you here, what it has learned,
              and a hide switch on each call.
            </Sheet>
          </div>
        </div>
      </Section>

      <Section tab="Commands" title="Everything, in seven commands.">
        <div data-pen="7" data-pen-points="0.9,0.5" className="paper divide-y divide-rule rounded-sm">
          {commands.map(([cmd, what]) => (
            <div
              key={cmd}
              className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="font-mono text-sm font-semibold">{cmd}</code>
              <span className="text-sm text-ink-muted">{what}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section tab="Privacy" title="It keeps receipts, not your chat.">
        <ul data-pen="8" data-pen-points="0.08,0.6" className="grid gap-5 sm:grid-cols-2">
          {privacy.map((p, i) => (
            <li
              key={p}
              className="paper rounded-sm p-5 font-mono text-sm"
              style={{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}
            >
              <span className="field-label mr-2">Clause {i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      </Section>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 text-center sm:px-6">
        <h2 data-pen="9" data-pen-points="0.35,1.08" className="font-form text-4xl font-extrabold uppercase tracking-tight sm:text-6xl">
          Settle it. <span className="hl text-ink">Remember it.</span>
        </h2>
        <a
          href={ADD_TO_GROUP}
          className="mt-10 inline-block rounded-md border-2 border-outline px-8 py-3.5 font-form text-sm font-extrabold uppercase tracking-wider text-ink shadow-[4px_4px_0_rgba(0,0,0,0.55)]"
          style={{ background: "var(--hl)" }}
        >
          Add{" "}
          {/* The pen signs the bot's name here at the end of its route. */}
          <span className="mx-1 font-hand text-3xl font-bold normal-case leading-none tracking-normal">
            <PenTail text="@mykoll_bot" letters={11} />
          </span>{" "}
          to your group
        </a>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="font-mono text-xs">
            Receipts · built for the Tatum × Walrus Total Recall hackathon
          </span>
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
