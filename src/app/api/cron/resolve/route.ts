import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { postWeeklyDigests } from "@/lib/digest";
import { nextSweep } from "@/lib/schedule";

/** Daily cron: settle anything due as a safety net, and on Sundays post each chat's weekly digest. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const bot = new Bot(config.telegram.botToken);
  await announceResolutions(bot);
  // Restarts the quarter-hourly sweep if it ever stopped.
  await nextSweep();
  await db(`delete from seen_updates where seen_at < now() - interval '2 days'`);
  const params = new URL(req.url).searchParams;
  const digest = !params.has("noDigest") && (new Date().getUTCDay() === 0 || params.has("digest"));
  if (digest) await postWeeklyDigests(bot);
  return Response.json({ ok: true, digest });
}
