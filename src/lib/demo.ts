// Placeholder data for the first screens, until calls come from the database.

export type Market = "crypto" | "cs2";
export type Outcome = "win" | "loss" | "open";

export interface Call {
  id: number;
  author: string;
  market: Market;
  quote: string;
  madeAt: string;
  deadline: string;
  outcome: Outcome;
  /** Price at the moment of the call and now (crypto only). */
  entry?: number;
  current?: number;
  target?: number;
  /** Final score (CS2 only). */
  score?: string;
}

export interface Member {
  handle: string;
  calls: number;
  hits: number;
  streak: number;
}

export const members: Record<Market, Member[]> = {
  crypto: [
    { handle: "ivan", calls: 18, hits: 13, streak: 4 },
    { handle: "max", calls: 23, hits: 14, streak: 1 },
    { handle: "oleh", calls: 9, hits: 5, streak: 0 },
    { handle: "sasha", calls: 31, hits: 12, streak: 0 },
  ],
  cs2: [
    { handle: "oleh", calls: 14, hits: 11, streak: 6 },
    { handle: "ivan", calls: 10, hits: 6, streak: 2 },
    { handle: "sasha", calls: 12, hits: 6, streak: 0 },
    { handle: "max", calls: 7, hits: 3, streak: 0 },
  ],
};

export const calls: Call[] = [
  {
    id: 142,
    author: "ivan",
    market: "crypto",
    quote: "SUI to $5 by Friday",
    madeAt: "30 Oct, 14:02",
    deadline: "Fri, 18:00",
    outcome: "loss",
    entry: 3.62,
    current: 3.8,
    target: 5,
  },
  {
    id: 139,
    author: "oleh",
    market: "cs2",
    quote: "NaVi take FaZe 2-0, Mirage is theirs",
    madeAt: "29 Oct, 19:40",
    deadline: "29 Oct, 21:30",
    outcome: "win",
    score: "NaVi 2 – 0 FaZe",
  },
  {
    id: 145,
    author: "max",
    market: "crypto",
    quote: "SOL holds 180 all week",
    madeAt: "31 Oct, 09:15",
    deadline: "Sun, 23:59",
    outcome: "open",
    entry: 186.4,
    current: 183.1,
    target: 180,
  },
];

export const hitRate = (m: Member) => Math.round((m.hits / m.calls) * 100);
