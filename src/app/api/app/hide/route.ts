import { setHidden } from "@/lib/calls";
import { chatMember } from "@/lib/telegramAuth";

/** Hides or restores one of the viewer's own calls. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { chat?: string; callId?: number; hidden?: boolean };
  const user = await chatMember(req, String(body.chat ?? ""));
  if (!user) return Response.json({ error: "Not a member of this chat." }, { status: 403 });
  const ok = await setHidden(Number(body.callId), user.id, Boolean(body.hidden));
  return ok ? Response.json({ ok }) : Response.json({ error: "You can only change your own calls." }, { status: 403 });
}
