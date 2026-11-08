import Link from "next/link";
import { MemberBadge } from "@/components/file/MemberBadge";
import { ChatPreview } from "@/components/landing/ChatPreview";
import { Suspense } from "react";
import { LivePrices, LivePricesSkeleton } from "@/components/landing/LivePrices";
import { LiveMemoryCheck } from "@/components/landing/LiveMemoryCheck";
import { LiveStats } from "@/components/landing/LiveStats";
import { JudgePath } from "@/components/landing/JudgePath";
import { cachedPrices, cachedStats } from "@/lib/live";
import { Intro } from "@/components/landing/Intro";
import { PenTail } from "@/components/landing/PenTail";
import { SameCall } from "@/components/landing/SameCall";
import { ScrollPen } from "@/components/landing/ScrollPen";
import { ReceiptCard, Taped } from "@/components/ReceiptCard";
import { demoCalls } from "@/lib/demo";

const ADD_TO_GROUP = "https://t.me/mykoll_bot?startgroup=receipts";
const GITHUB = "https://github.com/stkalper/MyKoll";

const steps = [
  {
    title: "Someone makes a call",
    text: "“SOL to 300 by Friday”, “easy for NaVi”, said in passing. The bot asks the author once, or logs it straight away in auto mode.",
  },
  {
    title: "It files the receipt",
    text: "The exact words, when, and the price or Polymarket odds at that second, sealed in the chat’s Walrus Memory.",
  },
  {
    title: "The verdict posts itself",
    text: "At the deadline, or the moment the price gets there, the result lands in the chat.",
  },
  {
    title: "It learns who to trust",
    text: "Every verdict updates the author’s record by kind of call, and their next call comes back with it.",
  },
];

const features = [
  {
    title: "New: follows Polymarket traders",
    text: "Paste a trader’s profile link. Their bets of $500+ on CS2, politics and crypto land as receipts with the stake and the price paid, settle when the market resolves, and build a record like any member’s. Up to 10 traders per chat.",
  },
  {
    title: "Its own odds, from memory",
    text: "Every receipt shows the bot’s chance the call comes true, worked out from the author’s record, next to Polymarket’s: 🎯 62% (5/7 on NaVi picks) · Polymarket 58%.",
  },
  {
    title: "A journal of your own",
    text: "No group to try it in? Write the bot privately. Your calls are logged right away, settled and remembered the same way.",
  },
  {
    title: "Answers from memory",
    text: "“Who called FURIA?” comes back with their own words and dates, and a list of the Walrus blobs behind the answer.",
  },
  {
    title: "Settles on its own",
    text: "Crypto on price, CS2 on the Polymarket result (from HLTV). Reply to a receipt to add your why, and everyone sees if it held up.",
  },
  {
    title: "Digest and share cards",
    text: "Sharpest caller and biggest miss of the week, every Sunday. Every verdict gets a signed public card; hidden calls stay hidden.",
  },
];

/** How people actually phrase calls, and what the bot files for each. */
const callFormats = [
  {
    kind: "Crypto",
    says: "SUI to $5 by Friday",
    files: "SUI above $5.00, judged at the end of Friday. Any language works.",
  },
  {
    kind: "Crypto",
    says: "BTC 102k tomorrow",
    files: "No side said, so it checks the price: BTC is below that, so it’s a call for up.",
  },
  {
    kind: "No date",
    says: "Sui 5$",
    files: "Gets a week. If SUI isn’t there by then, the author gives it another week or lets it go.",
  },
  {
    kind: "Signal",
    says: "TRX long from 0.34, TP 0.37. Broke resistance",
    files: "TRX above $0.37, with the reasoning on the receipt as the why.",
  },
  {
    kind: "CS2",
    says: "easy for Vitality · NaVi 2:1",
    files: "Finds the team’s next match and its Polymarket odds; a score is a map-score pick. Waits if the match isn’t listed yet.",
  },
  {
    kind: "Several",
    says: "NaVi, Vitality, FURIA, fnatic",
    files: "Four picks, one tap. When the last match ends: every winner and the score, 3/4.",
  },
  {
    kind: "A post",
    says: "x.com/cryptoguru/status/… or a forwarded post",
    files: "Filed under @cryptoguru, timed from when it went up.",
  },
  {
    kind: "A trader",
    says: "polymarket.com/@fred4332",
    files: "Follows the trader: each new $500+ bet on CS2, politics or crypto comes in as their call.",
  },
];

const memoryEntries = [
  {
    tag: "CALL",
    color: "border-stamp-open text-stamp-open",
    text: "@jake called “WAL to 5 cents by Friday”. WAL above $0.0500 by Fri 23:59. WAL was $0.0341 (on-chain via Tatum Sui RPC).",
  },
  {
    tag: "REASON",
    color: "border-ink-muted text-ink-muted",
    text: "@jake explained the call: storage usage keeps climbing, chart is coiling.",
  },
  {
    tag: "RESULT",
    color: "border-stamp-loss text-stamp-loss",
    text: "@jake’s call “WAL to 5 cents by Friday” was WRONG: WAL was $0.0362 at the deadline.",
  },
  {
    tag: "TRACK RECORD",
    color: "border-stamp-win text-stamp-win",
    text: "@jake is 13/18 right; strong on majors 9/10; weak on Sui tokens 1/4.",
  },
];

/** What happens after the call above, with a bot that forgets and with one that remembers. */
const withMemory = [
  {
    moment: "Max: “nah, SUI bleeds”",
    without: "One more opinion.",
    with: "Max is 3/3 on SUI, so the chat leans his way, even with more people siding with Jake.",
  },
  {
    moment: "Friday, 23:59",
    without: "SUI is $3.80.",
    with: "❌ Jake missed, with the Sui transaction to check it. Both records update.",
  },
  {
    moment: "A week later: “who’s good on SUI?”",
    without: "No idea.",
    with: "Max, 4/4, with his exact words and dates.",
  },
];

const memoryPoints = [
  {
    title: "The memory is the product",
    text: "Without memory the bot is a price alert. With it, the chat can ask what anyone said, when, and why, and get their own words back.",
  },
  {
    title: "It changes what the bot does",
    text: "Every verdict rewrites the author’s track record, and new calls come back with it. When several people call the same coin or match, it weighs them by that record. Say “not a call” and it asks you less; confirm a few and it stops asking.",
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
  ["/following", "Polymarket traders the chat follows"],
  ["/hide 12", "Take your call off the board and out of answers"],
  ["/mode", "Admins: ask first, or log automatically"],
  ["/public", "Admins: open the chat’s file to anyone with the link"],
];

const privacy = [
  "Stores calls, never the rest of the chat. In ask mode nothing is saved until the author taps “Log it”.",
  "Auto mode is opt-in per group, and the author can undo any call it logged.",
  "Hidden calls drop off the board, the share links and the bot’s answers.",
  "The Mini App shows a group only to its members, unless an admin makes its file public.",
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

/* The live parts of the page, rendered on the server from a shared two-minute cache (lib/live.ts),
   so they arrive with the page rather than after it. */
const Stats = async () => <LiveStats stats={await cachedStats()} />;
const MemorySoFar = async () => <LiveMemoryCheck stats={await cachedStats()} />;
const Prices = async () => <LivePrices prices={await cachedPrices()} />;
const ForJudges = async () => <JudgePath stats={await cachedStats()} />;

export default function Landing() {
  return (
    <main className="glow relative isolate flex-1">
      <Intro />
      <ScrollPen />
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="font-form text-lg font-extrabold uppercase tracking-[0.06em]">
          MyKoll
        </span>
        <div className="flex items-center gap-5 text-sm text-muted">
          <a href="#formats" className="hidden hover:text-text sm:inline">
            Formats
          </a>
          <a href="#memory" className="hidden hover:text-text sm:inline">
            Memory
          </a>
          <a href="#prices" className="hidden hover:text-text sm:inline">
            Prices
          </a>
          <a href="#judges" className="hidden hover:text-text sm:inline">
            For judges
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
          Crypto and CS2 calls, said the way people actually say them, get
          filed, judged when the deadline hits, and remembered. The bot learns
          who in your chat is worth listening to.
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
        <Suspense>
          <Stats />
        </Suspense>

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
        id="formats"
        tab="Call formats"
        title="Talk normally. It knows a call when it sees one."
      >
        <div className="paper rounded-sm p-5 sm:p-6">
          <div className="hidden grid-cols-[6rem_1fr_1.4fr] gap-6 border-b-2 border-ink pb-2 sm:grid">
            <span className="field-label">Kind</span>
            <span className="field-label">In the chat</span>
            <span className="field-label">What it files</span>
          </div>
          <ul>
            {callFormats.map((f) => (
              <li
                key={f.says}
                className="grid gap-1 border-b border-dashed border-rule py-3 last:border-b-0 sm:grid-cols-[6rem_1fr_1.4fr] sm:items-baseline sm:gap-6"
              >
                <span className="field-label">{f.kind}</span>
                <span className="font-hand text-xl leading-tight">“{f.says}”</span>
                <span className="font-mono text-xs leading-relaxed">{f.files}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 max-w-2xl text-sm text-muted">
          Questions, jokes and talk about matches already played are left
          alone.
        </p>
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
        <SameCall />
        <div className="paper mb-14 rounded-sm p-5 sm:p-6">
          <div className="hidden grid-cols-[1fr_1fr_2fr] gap-6 border-b-2 border-ink pb-2 sm:grid">
            <span className="field-label">Then</span>
            <span className="field-label">A bot that forgets</span>
            <span className="field-label">MyKoll, with Walrus Memory</span>
          </div>
          <ul>
            {withMemory.map((r) => (
              <li
                key={r.moment}
                className="grid gap-1 border-b border-dashed border-rule py-3 last:border-b-0 sm:grid-cols-[1fr_1fr_2fr] sm:gap-6"
              >
                <span className="font-hand text-xl leading-tight">{r.moment}</span>
                <span className="font-mono text-xs leading-relaxed text-ink-muted">
                  <span className="field-label mr-2 sm:hidden">Forgets:</span>
                  {r.without}
                </span>
                <span className="font-mono text-xs leading-relaxed">
                  <span className="field-label mr-2 sm:hidden">MyKoll:</span>
                  {r.with}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Suspense>
          <MemorySoFar />
        </Suspense>
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
                  <PenTail text="“who was bullish on Sui coins?” finds Jake's WAL call, though the word “bullish” is nowhere in it." />
                </p>
              </div>
            </Taped>
            {/* What the bot learned about Jake from those verdicts: the badge it holds up on his next call. */}
            <MemberBadge
              data-pen="4"
              name="@jake"
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
        <ul className="mb-6 max-w-2xl space-y-2 text-muted">
          <li>
            <span className="text-text">Majors</span>: Tatum&apos;s Price API.
          </li>
          <li>
            <span className="text-text">Sui tokens</span> (WAL, DEEP, NS): their
            Cetus pool on Sui mainnet, through Tatum&apos;s Sui gRPC.
          </li>
          <li>
            <span className="text-text">Stock tokens and memecoins</span> (TSLA,
            PONS): their Uniswap pool on Robinhood Chain, through Tatum&apos;s RPC.
          </li>
          <li>
            <span className="text-text">CS2</span>: Polymarket odds and results,
            through Tatum&apos;s Prediction Market API.
          </li>
        </ul>
        <p className="mb-8 max-w-2xl text-sm text-muted">
          Each on-chain price links to where it was read. Our Tatum credits ran
          out mid-hackathon, so for now the bot falls back to public endpoints
          when Tatum says so, and every receipt names the source it really
          used. Live right now:
        </p>
        <div data-pen="5" data-pen-points="0.12,0.5">
          <Suspense fallback={<LivePricesSkeleton />}>
            <Prices />
          </Suspense>
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
              title="MyKoll Mini App demo"
              className="h-[680px] w-full rounded-[36px] bg-bg"
              loading="lazy"
            />
          </div>
          <div className="space-y-5">
            <Sheet label="Tab 1" title="Board">
              Hit rate per member in crypto, CS2 and followed traders&apos; bets.
              Tap anyone for their file: what the bot learned and every call.
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

      <Section tab="Commands" title="Nine commands. Plain talk does the rest.">
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

      <Section id="judges" tab="For judges" title="See it work without joining a chat.">
        <Suspense fallback={<JudgePath stats={null} />}>
          <ForJudges />
        </Suspense>
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
            MyKoll · built for the Tatum × Walrus Total Recall hackathon
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
