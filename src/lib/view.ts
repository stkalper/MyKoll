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
  /** "price-api", "sui-onchain" or "robinhood-onchain" for price calls. */
  priceSource?: string;
  /** On-chain prices: the explorer page behind the pool price the call was judged by (or logged at). */
  proofUrl?: string;
  /** Which chain that page is on: "Sui" or "Robinhood Chain". */
  proofChain?: string;
  /** CS2 calls matched on Polymarket: the pick as Polymarket names it, its price when called, and the market. */
  polymarket?: { team: string; prob: number; url: string };
  /** On-chain prices: the Price API's price for the same moment, and how far apart the two are (0.012 = 1.2%). */
  check?: { price: number; apart: number };
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
}

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
  me: { id: number };
  boards: Record<Market, StandingView[]>;
  recent: ReceiptView[];
  mine: ReceiptView[];
  learned?: LearnedView;
  /** How the bot has adapted to the viewer: whether it still asks, and how many misreads it learned from. */
  habits?: { habit?: string; misreads: number };
  /** Whether the memory is earning its keep in this chat (see scorecard.ts). */
  memoryCheck?: MemoryCheckView;
}

/** The bot's trust, scored against outcomes, next to a bot that forgets. */
export interface MemoryCheckView {
  calls: number;
  withRecord: number;
  brierMemory: number | null;
  brierForgetful: number | null;
  spots: Record<"weak" | "strong" | "none", { calls: number; hits: number }>;
}

export const hitRate = (s: StandingView) => Math.round((s.hits / s.calls) * 100);
