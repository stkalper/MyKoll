import { callsBy, chatTitle, leaderboard, reasonsFor, recentCalls, when, withBlobs, type Standing } from "@/lib/calls";
import { recentEffects } from "@/lib/effects";
import { habitsView } from "@/lib/habits";
import { insightLine, trackRecords, type TrackRecord } from "@/lib/learning";
import { toView } from "@/lib/receipts";
import { memoryScorecard } from "@/lib/scorecard";
import { chatMember } from "@/lib/telegramAuth";
import type { BoardView, StandingView } from "@/lib/view";

const toStanding = (records: Map<string, TrackRecord>) => (s: Standing): StandingView => {
  const record = records.get(String(s.author_id));
  return { name: s.author_name, calls: s.calls, hits: s.hits, insight: record ? insightLine(record) || undefined : undefined };
};

/** The Mini App's whole view of one chat: boards, latest receipts, and the viewer's own calls. */
export async function GET(req: Request) {
  const chatId = new URL(req.url).searchParams.get("chat") ?? "";
  const user = await chatMember(req, chatId);
  if (!user) return Response.json({ error: "Open this from your group's /board button." }, { status: 403 });

  const [crypto, cs2, latest, myCalls, title, records, habits, effects] = await Promise.all([
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
    recentCalls(chatId),
    callsBy(chatId, user.id),
    chatTitle(chatId),
    trackRecords(chatId),
    habitsView(chatId, user.id),
    recentEffects(chatId),
  ]);
  const sealed = new Map((await withBlobs([...new Map([...latest, ...myCalls].map((c) => [c.id, c])).values()])).map((c) => [c.id, c]));
  const recent = latest.map((c) => sealed.get(c.id) ?? c);
  const mine = myCalls.map((c) => sealed.get(c.id) ?? c);
  const memoryCheck = await memoryScorecard(chatId);
  const mineLearned = records.get(String(user.id));
  const reasons = await reasonsFor([...new Set([...recent, ...mine].map((c) => c.id))]);
  const view: BoardView = {
    chat: { id: chatId, title: title ?? recent[0]?.chat_title ?? "Your chat" },
    me: { id: user.id },
    boards: { crypto: crypto.map(toStanding(records)), cs2: cs2.map(toStanding(records)) },
    recent: recent.map((c) => toView(c, reasons)),
    mine: mine.map((c) => toView(c, reasons)),
    learned: mineLearned && {
      name: mineLearned.authorName,
      hits: mineLearned.hits,
      calls: mineLearned.calls,
      summary: mineLearned.summary,
      strong: mineLearned.strong,
      weak: mineLearned.weak,
    },
    habits,
    memoryCheck: memoryCheck.calls ? memoryCheck : undefined,
    memoryEffects: effects.map((e) => ({ kind: e.kind, text: e.text, when: when(e.created_at) })),
  };
  return Response.json(view);
}
