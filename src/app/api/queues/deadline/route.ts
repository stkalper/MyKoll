import { handleCallback } from "@vercel/queue";
import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import type { CallRow } from "@/lib/calls";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { MATCH_POLL_SECONDS, wakeAt } from "@/lib/schedule";

/** CS2 calls on a Polymarket match are checked for this long past their deadline before giving up. */
const MATCH_GRACE = 24 * 3_600_000;

/**
 * A call's wake-up arrived: settle everything that is due. Safe to deliver twice.
 * A CS2 call on a Polymarket match keeps waking every 15 minutes until Polymarket resolves it, so the
 * result reaches the chat soon after the match ends, whether that's before its deadline or long after.
 */
export const POST = handleCallback(
  async (message: { callId: number }) => {
    const [call] = await db<CallRow>(`select * from calls where id = $1`, [message.callId]);
    if (!call || (call.status !== "open" && call.status !== "awaiting_score")) return;
    const deadline = new Date(call.deadline).getTime();
    const onMarket = call.market === "cs2" && Boolean(call.market_ref);
    if (!onMarket && deadline > Date.now()) return wakeAt(call.id, call.deadline);

    await announceResolutions(new Bot(config.telegram.botToken));

    if (!onMarket) return;
    const [after] = await db<Pick<CallRow, "status">>(`select status from calls where id = $1`, [call.id]);
    const unsettled = after?.status === "open" || after?.status === "awaiting_score";
    if (unsettled && Date.now() < deadline + MATCH_GRACE) await wakeAt(call.id, new Date(Date.now() + MATCH_POLL_SECONDS * 1000));
  },
  {
    retry: (_error, metadata) => (metadata.deliveryCount > 5 ? { acknowledge: true } : { afterSeconds: 30 * metadata.deliveryCount }),
  },
);
