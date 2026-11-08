import { knownChats } from "@/lib/calls";
import { db } from "@/lib/db";
import { appUser, isMember } from "@/lib/telegramAuth";
import { PERSONAL_TITLE } from "@/lib/view";

/** Groups the viewer shares with the bot, and their personal journal if they keep one, for when the Mini App is opened without a chat. */
export async function GET(req: Request) {
  const user = appUser(req);
  if (!user) return Response.json({ error: "Open this inside Telegram." }, { status: 403 });
  const [chats, journal] = await Promise.all([knownChats(), db(`select 1 from calls where chat_id = $1 limit 1`, [user.id])]);
  const member = await Promise.all(chats.map((c) => isMember(c.chat_id, user.id).catch(() => false)));
  const groups = chats.filter((_, i) => member[i]).map((c) => ({ id: String(c.chat_id), title: c.title ?? "Group" }));
  return Response.json({ chats: journal.length ? [...groups, { id: String(user.id), title: PERSONAL_TITLE }] : groups });
}
