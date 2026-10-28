import type { BoardView, ReceiptView } from "./view";

// Sample chat shown on the landing page and when the Mini App is opened outside Telegram.

export const demoCalls: ReceiptView[] = [
  {
    id: 142,
    author: "@ivan",
    market: "crypto",
    quote: "SUI to $5 by Friday",
    claim: "SUI above $5.00",
    reasons: ["Walrus mainnet usage is exploding and shorts are stacked above $4"],
    madeAt: "Thursday 30 Oct, 14:02",
    deadline: "Friday 31 Oct, 23:59",
    outcome: "loss",
    entry: 3.62,
    final: 3.8,
    note: "SUI was $3.80 at the deadline",
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
    quote: "SOL holds 180 all week",
    claim: "SOL above $180.00",
    madeAt: "Friday 31 Oct, 09:15",
    deadline: "Sunday 2 Nov, 23:59",
    outcome: "open",
    entry: 186.4,
  },
];

export const demoBoard: BoardView = {
  chat: { id: "demo", title: "Degen Club (demo)" },
  me: { id: 0 },
  boards: {
    crypto: [
      { name: "@ivan", calls: 18, hits: 13 },
      { name: "@max", calls: 23, hits: 14 },
      { name: "@oleh", calls: 9, hits: 5 },
      { name: "@sasha", calls: 31, hits: 12 },
    ],
    cs2: [
      { name: "@oleh", calls: 14, hits: 11 },
      { name: "@ivan", calls: 10, hits: 6 },
      { name: "@sasha", calls: 12, hits: 6 },
      { name: "@max", calls: 7, hits: 3 },
    ],
  },
  recent: demoCalls,
  mine: [demoCalls[0], { ...demoCalls[2], id: 120, quote: "ETH flips 5k this month", claim: "ETH above $5,000", outcome: "loss", hidden: true }],
};
