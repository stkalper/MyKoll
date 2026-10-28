import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import { config } from "@/lib/config";

/** Daily safety net (Vercel Cron) and the target for delayed queue messages: settle due calls. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await announceResolutions(new Bot(config.telegram.botToken));
  return Response.json({ ok: true });
}
