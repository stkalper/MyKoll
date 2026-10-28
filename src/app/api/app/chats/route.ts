import { knownChats } from "@/lib/calls";
import { appUser, isMember } from "@/lib/telegramAuth";

/** Groups the viewer shares with the bot, for when the Mini App is opened without a chat. */
export async function GET(req: Request) {
  const user = appUser(req);
  if (!user) return Response.json({ error: "Open this inside Telegram." }, { status: 403 });
  const chats = await knownChats();
  const member = await Promise.all(chats.map((c) => isMember(c.chat_id, user.id).catch(() => false)));
  return Response.json({ chats: chats.filter((_, i) => member[i]).map((c) => ({ id: String(c.chat_id), title: c.title ?? "Group" })) });
}
