import type { BoardView, ReceiptView } from "./view";

// Sample chat shown on the landing page and when the Mini App is opened outside Telegram.

export const demoCalls: ReceiptView[] = [
  {
    id: 142,
    author: "@ivan",
    market: "crypto",
    quote: "WAL to 5 cents by Friday",
    claim: "WAL above $0.0500",
    reasons: ["Walrus storage usage keeps climbing and the chart is coiling"],
    madeAt: "Thursday 30 Oct, 14:02",
    deadline: "Friday 31 Oct, 23:59",
    outcome: "loss",
    entry: 0.0341,
    final: 0.0362,
    priceSource: "sui-onchain",
    note: "WAL was $0.0362 at the deadline",
  },
  {
    id: 139,
    author: "@oleh",
    market: "cs2",
    quote: "NaVi take FaZe 2-0, Mirage is theirs",
    claim: "NaVi to beat FaZe",
    madeAt: "Wednesday 29 Oct, 19:40",
    deadline: "Wednesday 29 Oct, 21:30",
    outcome: "win",
    note: "NaVi won (confirmed by @max)",
  },
  {
    id: 145,
    author: "@max",
    market: "crypto",
    quote: "BTC holds 78k all week",
    claim: "BTC above $78,000",
    madeAt: "Friday 31 Oct, 09:15",
    deadline: "Sunday 2 Nov, 23:59",
    outcome: "open",
    entry: 80701,
  },
];

export const demoBoard: BoardView = {
  chat: { id: "demo", title: "Degen Club (demo)" },
  me: { id: 0 },
  boards: {
    crypto: [
      { name: "@ivan", calls: 18, hits: 13, insight: "strong: majors · weak: Sui tokens" },
      { name: "@max", calls: 23, hits: 14, insight: "weak: calls under a day" },
      { name: "@oleh", calls: 9, hits: 5 },
      { name: "@sasha", calls: 31, hits: 12 },
    ],
    cs2: [
      { name: "@oleh", calls: 14, hits: 11, insight: "strong: CS2 picks, NaVi picks" },
      { name: "@ivan", calls: 10, hits: 6 },
      { name: "@sasha", calls: 12, hits: 6 },
      { name: "@max", calls: 7, hits: 3 },
    ],
  },
  recent: demoCalls,
  mine: [demoCalls[0], { ...demoCalls[2], id: 120, quote: "DEEP to 3 cents this month", claim: "DEEP above $0.0300", priceSource: "sui-onchain", entry: 0.017, outcome: "loss", hidden: true }],
  learned: {
    summary: "@ivan is 13/18 right; strong on majors 9/10; weak on Sui tokens 1/4.",
    strong: [{ segment: "majors", hits: 9, calls: 10 }],
    weak: [{ segment: "Sui tokens", hits: 1, calls: 4 }],
  },
};
