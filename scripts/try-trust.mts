// Does the bot's trust predict outcomes better than a coin flip, and how many calls does it take?
// Simulated chats only, so the formula isn't tuned to the few real calls it's judged on.
//   npx tsx --env-file=.env.local scripts/try-trust.mts
import type { CallRow } from "../src/lib/calls";
import { trackRecordOf, trustOn, type TrackRecord } from "../src/lib/learning";

const DAY = 86_400_000;
const COINS = ["BTC", "SOL", "WAL"];
const clamp = (x: number) => Math.min(0.9, Math.max(0.1, x));
const normal = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

/** The earlier formula: a member's hit rate on the closest kind of call, plus one hit and one miss. */
function laplace(record: TrackRecord | undefined, c: CallRow) {
  if (!record) return 0.5;
  const r = record.segments.find((s) => s.segment === `${c.subject} calls`) ?? { hits: record.hits, calls: record.calls };
  return (r.hits + 1) / (r.calls + 2);
}

/** One chat's settled calls, in the order they were made, each settled before the next. */
function chat(members: number, total: number, skill: number): CallRow[] {
  const people = Array.from({ length: members }, () => {
    const base = 0.5 + normal() * skill;
    return COINS.map(() => clamp(base + normal() * skill * 0.8));
  });
  return Array.from({ length: total }, (_, i) => {
    const author = i % members;
    const coin = Math.floor(Math.random() * COINS.length);
    const made = new Date(i * DAY);
    return {
      id: i,
      chat_id: "1",
      author_id: String(author),
      author_name: `@m${author}`,
      market: "crypto",
      subject: COINS[coin],
      direction: "above",
      made_at: made,
      deadline: new Date(i * DAY + 0.5 * DAY),
      resolved_at: new Date(i * DAY + 0.5 * DAY),
      status: Math.random() < people[author][coin] ? "win" : "loss",
    } as CallRow;
  });
}

function score(calls: CallRow[], weight: (r: TrackRecord | undefined, c: CallRow) => number) {
  let sum = 0;
  for (const c of calls) {
    const before = calls.filter((p) => p.author_id === c.author_id && p.id < c.id);
    sum += (weight(trackRecordOf(before) ?? undefined, c) - (c.status === "win" ? 1 : 0)) ** 2;
  }
  return sum / calls.length;
}

const RUNS = 1500;
console.log("calls | how different members are | old formula | new formula | new beats a coin flip in");
for (const [total, skill, label] of [
  [13, 0.15, "quite different"],
  [30, 0.15, "quite different"],
  [100, 0.15, "quite different"],
  [13, 0.08, "a little different"],
  [30, 0.08, "a little different"],
  [100, 0.08, "a little different"],
  [30, 0, "all the same"],
  [100, 0, "all the same"],
] as const) {
  let before = 0;
  let after = 0;
  let wins = 0;
  for (let i = 0; i < RUNS; i++) {
    const calls = chat(3, total, skill);
    before += score(calls, laplace);
    const now = score(calls, (r, c) => trustOn(r, c).weight);
    after += now;
    if (now < 0.25) wins++;
  }
  console.log(`${total} | ${label} | ${(before / RUNS).toFixed(4)} | ${(after / RUNS).toFixed(4)} | ${Math.round((wins / RUNS) * 100)}% of chats`);
}
process.exit(0);
