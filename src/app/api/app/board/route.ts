import { callsBy, chatTitle, isPublicChat, leaderboard, reasonsFor, recentCalls, when, withBlobs, type Standing } from "@/lib/calls";
import { recentEffects } from "@/lib/effects";
import { habitsView } from "@/lib/habits";
import { insightLine, trackRecords, type TrackRecord } from "@/lib/learning";
import { chatOfFile, toView } from "@/lib/receipts";
import { memoryScorecard } from "@/lib/scorecard";
import { chatMember } from "@/lib/telegramAuth";
import type { BoardView, StandingView } from "@/lib/view";

const toStanding = (records: Map<string, TrackRecord>, cs2 = false) => (s: Standing): StandingView => {
  const record = records.get(String(s.author_id));
  const edge = cs2 && record?.marketEdge !== undefined ? Math.round(record.marketEdge * 100) : undefined;
  return { name: s.author_name, calls: s.calls, hits: s.hits, insight: record ? insightLine(record) || undefined : undefined, vsMarket: edge };
};

/**
 * The Mini App's whole view of one chat: boards, latest receipts, and the viewer's own calls.
 * With `file=<signed link>` it is the chat's public file instead, if an admin made it public:
 * the same board and receipts for anyone, with nobody's own file in it.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const file = params.get("file");
  if (file) {
    const chatId = chatOfFile(file);
    if (!chatId || !(await isPublicChat(chatId))) return Response.json({ error: "This chat's file isn't public." }, { status: 404 });
    return Response.json(await chatView(chatId, null), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  }

  const chatId = params.get("chat") ?? "";
  const user = await chatMember(req, chatId);
  if (!user) return Response.json({ error: "Open this from your group's /board button." }, { status: 403 });
  return Response.json(await chatView(chatId, user.id));
}

async function chatView(chatId: string, userId: number | null): Promise<BoardView> {
  const [crypto, cs2, latest, myCalls, title, records, habits, effects] = await Promise.all([
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
    recentCalls(chatId),
    userId ? callsBy(chatId, userId) : [],
    chatTitle(chatId),
    trackRecords(chatId),
    userId ? habitsView(chatId, userId) : undefined,
    recentEffects(chatId),
  ]);
  const sealed = new Map((await withBlobs([...new Map([...latest, ...myCalls].map((c) => [c.id, c])).values()])).map((c) => [c.id, c]));
  const recent = latest.map((c) => sealed.get(c.id) ?? c);
  const mine = myCalls.map((c) => sealed.get(c.id) ?? c);
  const memoryCheck = await memoryScorecard(chatId);
  const mineLearned = userId ? records.get(String(userId)) : undefined;
  const reasons = await reasonsFor([...new Set([...recent, ...mine].map((c) => c.id))]);
  return {
    chat: { id: chatId, title: title ?? recent[0]?.chat_title ?? "Your chat" },
    me: userId ? { id: userId } : null,
    boards: { crypto: crypto.map(toStanding(records)), cs2: cs2.map(toStanding(records, true)) },
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
}
