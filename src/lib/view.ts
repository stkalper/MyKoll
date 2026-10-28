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
  hidden?: boolean;
}

export interface StandingView {
  name: string;
  calls: number;
  hits: number;
}

export interface BoardView {
  chat: { id: string; title: string };
  me: { id: number };
  boards: Record<Market, StandingView[]>;
  recent: ReceiptView[];
  mine: ReceiptView[];
}

export const hitRate = (s: StandingView) => Math.round((s.hits / s.calls) * 100);
