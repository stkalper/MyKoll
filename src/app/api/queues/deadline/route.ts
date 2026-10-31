import { handleCallback } from "@vercel/queue";
import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import type { CallRow } from "@/lib/calls";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { MATCH_POLL_SECONDS, nextSweep, wakeAt, type WakeMessage } from "@/lib/schedule";

/** CS2 calls on a Polymarket match are checked for this long past their deadline before giving up. */
const MATCH_GRACE = 24 * 3_600_000;

/**
 * A wake-up arrived: settle everything that is due and post it. Safe to deliver twice.
 * - A sweep runs every quarter hour while any call is running, and queues the next one.
 * - A call's own wake-up comes at its deadline. A CS2 call on a Polymarket match keeps waking every
 *   15 minutes until Polymarket resolves it, whether that's before its deadline or long after.
 */
export const POST = handleCallback(
  async (message: WakeMessage) => {
    const bot = new Bot(config.telegram.botToken);
    if ("sweep" in message) {
      await announceResolutions(bot);
      const [running] = await db<{ n: number }>(`select count(*)::int as n from calls where status in ('open', 'awaiting_score')`);
      if (running?.n) await nextSweep();
      return;
    }

    const [call] = await db<CallRow>(`select * from calls where id = $1`, [message.callId]);
    if (!call || (call.status !== "open" && call.status !== "awaiting_score")) return;
    const deadline = new Date(call.deadline).getTime();
    const onMarket = call.market === "cs2" && Boolean(call.market_ref);
    if (!onMarket && deadline > Date.now()) return wakeAt(call.id, call.deadline);

    await announceResolutions(bot);

    if (!onMarket) return;
    const [after] = await db<Pick<CallRow, "status">>(`select status from calls where id = $1`, [call.id]);
    const unsettled = after?.status === "open" || after?.status === "awaiting_score";
    if (unsettled && Date.now() < deadline + MATCH_GRACE) await wakeAt(call.id, new Date(Date.now() + MATCH_POLL_SECONDS * 1000));
  },
  {
    retry: (_error, metadata) => (metadata.deliveryCount > 5 ? { acknowledge: true } : { afterSeconds: 30 * metadata.deliveryCount }),
  },
);
