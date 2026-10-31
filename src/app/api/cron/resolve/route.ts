import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import { config } from "@/lib/config";
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
  const digest = new Date().getUTCDay() === 0 || new URL(req.url).searchParams.has("digest");
  if (digest) await postWeeklyDigests(bot);
  return Response.json({ ok: true, digest });
}
