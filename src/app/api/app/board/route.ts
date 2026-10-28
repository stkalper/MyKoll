import { callsBy, claim, leaderboard, recentCalls, when, type CallRow, type Standing } from "@/lib/calls";
import { chatMember } from "@/lib/telegramAuth";
import type { BoardView, ReceiptView, StandingView } from "@/lib/view";

const outcome = (s: CallRow["status"]): ReceiptView["outcome"] =>
  s === "win" ? "win" : s === "loss" ? "loss" : s === "void" ? "void" : "open";

function toView(c: CallRow): ReceiptView {
  return {
    id: c.id,
    author: c.author_name,
    market: c.market,
    quote: c.quote,
    claim: claim(c),
    madeAt: when(c.made_at),
    deadline: when(c.deadline),
    outcome: outcome(c.status),
    entry: c.entry_price ?? undefined,
    final: c.final_price ?? undefined,
    note: c.result_note ?? undefined,
    hidden: c.hidden,
  };
}

const toStanding = (s: Standing): StandingView => ({ name: s.author_name, calls: s.calls, hits: s.hits });

/** The Mini App's whole view of one chat: boards, latest receipts, and the viewer's own calls. */
export async function GET(req: Request) {
  const chatId = new URL(req.url).searchParams.get("chat") ?? "";
  const user = await chatMember(req, chatId);
  if (!user) return Response.json({ error: "Open this from your group's /board button." }, { status: 403 });

  const [crypto, cs2, recent, mine] = await Promise.all([
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
    recentCalls(chatId),
    callsBy(chatId, user.id),
  ]);
  const view: BoardView = {
    chat: { id: chatId, title: recent[0]?.chat_title ?? mine[0]?.chat_title ?? "Your chat" },
    me: { id: user.id },
    boards: { crypto: crypto.map(toStanding), cs2: cs2.map(toStanding) },
    recent: recent.map(toView),
    mine: mine.map(toView),
  };
  return Response.json(view);
}
