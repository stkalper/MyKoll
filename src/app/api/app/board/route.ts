import { callsBy, chatTitle, isPublicChat, leaderboard, reasonsFor, recentCalls, when, withBlobs, type Standing } from "@/lib/calls";
import { changesOfMind, recentEffects } from "@/lib/effects";
import { habitsView } from "@/lib/habits";
import { insightLine, trackRecords, type TrackRecord } from "@/lib/learning";
import { chatOfFile, toView } from "@/lib/receipts";
import { memoryScorecard } from "@/lib/scorecard";
import { chatMember } from "@/lib/telegramAuth";
import type { BoardView, LearnedView, MemberView, StandingView } from "@/lib/view";

const toStanding = (records: Map<string, TrackRecord>, against?: "cs2" | "bets") => (s: Standing): StandingView => {
  const record = records.get(String(s.author_id));
  const raw = against === "cs2" ? record?.marketEdge : against === "bets" ? record?.betEdge : undefined;
  const edge = raw !== undefined ? Math.round(raw * 100) : undefined;
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
  // With `member=<name>`, one member's file in the chat instead of the whole chat.
  const member = params.get("member");
  if (file) {
    const chatId = chatOfFile(file);
    if (!chatId || !(await isPublicChat(chatId))) return Response.json({ error: "This chat's file isn't public." }, { status: 404 });
    const view = member ? await memberView(chatId, member) : await chatView(chatId, null);
    if (!view) return Response.json({ error: "No one by that name has settled calls here." }, { status: 404 });
    return Response.json(view, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  }

  const chatId = params.get("chat") ?? "";
  const user = await chatMember(req, chatId);
  if (!user) return Response.json({ error: "Open this from your group's /board button." }, { status: 403 });
  if (member) {
    const view = await memberView(chatId, member);
    return view ? Response.json(view) : Response.json({ error: "No one by that name has settled calls here." }, { status: 404 });
  }
  return Response.json(await chatView(chatId, user.id));
}

const learnedOf = (r: TrackRecord): LearnedView => ({ name: r.authorName, hits: r.hits, calls: r.calls, summary: r.summary, strong: r.strong, weak: r.weak });

/**
 * A member's file, as anyone who can see the chat's board sees it: what the bot has learned about
 * them and every call of theirs still on the board (hidden ones stay out). Found by the name on the
 * board, so a member's Telegram id never leaves the server.
 */
async function memberView(chatId: string, name: string): Promise<MemberView | null> {
  const [crypto, cs2, bets, records] = await Promise.all([leaderboard(chatId, "crypto"), leaderboard(chatId, "cs2"), leaderboard(chatId, "polymarket"), trackRecords(chatId)]);
  const standing = [...crypto, ...cs2, ...bets].find((s) => s.author_name === name);
  if (!standing) return null;
  const rows = (await callsBy(chatId, standing.author_id)).filter((c) => !c.hidden);
  const [sealed, reasons] = await Promise.all([withBlobs(rows), reasonsFor(rows.map((c) => c.id))]);
  const record = records.get(String(standing.author_id));
  return { name, learned: record ? learnedOf(record) : undefined, calls: sealed.map((c) => toView(c, reasons)) };
}

async function chatView(chatId: string, userId: number | null): Promise<BoardView> {
  const [crypto, cs2, bets, latest, myCalls, title, records, habits, effects, minds] = await Promise.all([
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
    leaderboard(chatId, "polymarket"),
    recentCalls(chatId),
    userId ? callsBy(chatId, userId) : [],
    chatTitle(chatId),
    trackRecords(chatId),
    userId ? habitsView(chatId, userId) : undefined,
    recentEffects(chatId),
    changesOfMind(chatId),
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
    boards: { crypto: crypto.map(toStanding(records)), cs2: cs2.map(toStanding(records, "cs2")), ...(bets.length ? { polymarket: bets.map(toStanding(records, "bets")) } : {}) },
    recent: recent.map((c) => toView(c, reasons)),
    mine: mine.map((c) => toView(c, reasons)),
    learned: mineLearned && learnedOf(mineLearned),
    habits,
    memoryCheck: memoryCheck.calls ? memoryCheck : undefined,
    memoryEffects: effects.map((e) => ({ kind: e.kind, text: e.text, when: when(e.created_at) })),
    mindChanges: minds.map((m) => ({ member: m.member, changes: m.changes.map((c) => ({ after: c.after, what: c.what, when: when(c.at) })) })),
  };
}
