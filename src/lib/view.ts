// Shapes the Mini App renders. Kept free of server imports so client components can use them.

export type Market = "crypto" | "cs2";
export type Outcome = "win" | "loss" | "open" | "void";

export interface ReceiptView {
  id: number;
  author: string;
  market: Market;
  quote: string;
  claim: string;
  madeAt: string;
  deadline: string;
  outcome: Outcome;
  /** Price when the call was made and when it was settled (crypto only). */
  entry?: number;
  final?: number;
  note?: string;
  /** The PriceSource behind a price call. */
  priceSource?: string;
  /** On-chain prices: the explorer page behind the pool price the call was judged by (or logged at). */
  proofUrl?: string;
  /** Which chain that page is on: "Sui" or "Robinhood Chain". */
  proofChain?: string;
  /** CS2 calls matched on Polymarket: the pick as Polymarket names it, its price when called, and the market. */
  polymarket?: { team: string; prob: number; url: string; direct?: boolean };
  /** On-chain prices: the Price API's price for the same moment, and how far apart the two are (0.012 = 1.2%). */
  check?: { price: number; apart: number };
  /** Where this call's memory is sealed on Walrus Mainnet, once it is. */
  blobUrl?: string;
  /** The author's own "why", added by replying to the receipt. */
  reasons?: string[];
  hidden?: boolean;
}

export interface StandingView {
  name: string;
  calls: number;
  hits: number;
  /** What the bot has learned about them, e.g. "strong: CS2 picks · weak: Sui tokens". */
  insight?: string;
  /** CS2 only: how many points their hit rate beats (or trails) the odds Polymarket gave their picks. */
  vsMarket?: number;
}

/** "+12 pts vs Polymarket" / "−8 pts vs Polymarket". */
export const vsMarketText = (pts: number) => `${pts >= 0 ? "+" : "−"}${Math.abs(pts)} pts vs Polymarket`;

/** The bot's learned view of the viewer, from their settled calls. */
export interface LearnedView {
  name: string;
  hits: number;
  calls: number;
  summary: string;
  strong: { segment: string; hits: number; calls: number }[];
  weak: { segment: string; hits: number; calls: number }[];
}

export interface BoardView {
  chat: { id: string; title: string };
  /** Null on a chat's public file, which shows nobody's own file. */
  me: { id: number } | null;
  boards: Record<Market, StandingView[]>;
  recent: ReceiptView[];
  mine: ReceiptView[];
  learned?: LearnedView;
  /** How the bot has adapted to the viewer: whether it still asks, and how many misreads it learned from. */
  habits?: { habit?: string; misreads: number };
  /** Whether the memory is earning its keep in this chat (see scorecard.ts). */
  memoryCheck?: MemoryCheckView;
  /** The latest times what the bot remembered changed what it did in this chat. */
  memoryEffects?: { kind: MemoryEffectKind; text: string; when: string }[];
}

export type MemoryEffectKind = "weak_spot" | "strong_spot" | "last_time" | "room" | "logged_without_asking" | "asked_first" | "stayed_quiet" | "record_changed";

/** What each kind of change is called when they're counted. */
export const effectLabel: Record<MemoryEffectKind, string> = {
  weak_spot: "weak spots flagged",
  strong_spot: "strong spots flagged",
  last_time: "past calls brought back",
  room: "rooms weighed by record",
  logged_without_asking: "logged without asking",
  asked_first: "asked first after a misread",
  stayed_quiet: "misreads not repeated",
  record_changed: "minds changed about someone",
};

/** Below this, a score says more about luck than about the memory: one call can move it past 0.25. */
export const MEMORY_CHECK_CALLS = 30;
const MEMORY_CHECK_WITH_RECORD = 15;

export const memoryCheckReady = (c: Pick<MemoryCheckView, "calls" | "withRecord" | "brierMemory">) =>
  c.calls >= MEMORY_CHECK_CALLS && c.withRecord >= MEMORY_CHECK_WITH_RECORD && c.brierMemory !== null;

/** The bot's trust, scored against outcomes, next to a bot that forgets. */
export interface MemoryCheckView {
  calls: number;
  withRecord: number;
  brierMemory: number | null;
  brierForgetful: number | null;
  /**
   * A bot that remembers nothing about anyone, only how often calls in the chat came true so far.
   * The memory has to beat this to show it learned something about people, not just about the chat.
   */
  brierChatRate?: number | null;
  spots: Record<"weak" | "strong" | "none", { calls: number; hits: number }>;
}

export const hitRate = (s: StandingView) => Math.round((s.hits / s.calls) * 100);
