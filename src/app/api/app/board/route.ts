import { callsBy, chatTitle, leaderboard, reasonsFor, recentCalls, type Standing } from "@/lib/calls";
import { toView } from "@/lib/receipts";
import { chatMember } from "@/lib/telegramAuth";
import type { BoardView, StandingView } from "@/lib/view";

const toStanding = (s: Standing): StandingView => ({ name: s.author_name, calls: s.calls, hits: s.hits });

/** The Mini App's whole view of one chat: boards, latest receipts, and the viewer's own calls. */
export async function GET(req: Request) {
  const chatId = new URL(req.url).searchParams.get("chat") ?? "";
  const user = await chatMember(req, chatId);
  if (!user) return Response.json({ error: "Open this from your group's /board button." }, { status: 403 });

  const [crypto, cs2, recent, mine, title] = await Promise.all([
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
    recentCalls(chatId),
    callsBy(chatId, user.id),
    chatTitle(chatId),
  ]);
  const reasons = await reasonsFor([...new Set([...recent, ...mine].map((c) => c.id))]);
  const view: BoardView = {
    chat: { id: chatId, title: title ?? recent[0]?.chat_title ?? "Your chat" },
    me: { id: user.id },
    boards: { crypto: crypto.map(toStanding), cs2: cs2.map(toStanding) },
    recent: recent.map((c) => toView(c, reasons)),
    mine: mine.map((c) => toView(c, reasons)),
  };
  return Response.json(view);
}
