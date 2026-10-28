import { handleCallback } from "@vercel/queue";
import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import type { CallRow } from "@/lib/calls";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { wakeAt } from "@/lib/schedule";

/** A call's deadline arrived: settle everything that is due. Safe to deliver twice. */
export const POST = handleCallback(
  async (message: { callId: number }) => {
    const [call] = await db<CallRow>(`select * from calls where id = $1`, [message.callId]);
    if (!call || call.status !== "open") return;
    if (new Date(call.deadline).getTime() > Date.now()) return wakeAt(call.id, call.deadline);
    await announceResolutions(new Bot(config.telegram.botToken));
  },
  {
    retry: (_error, metadata) => (metadata.deliveryCount > 5 ? { acknowledge: true } : { afterSeconds: 30 * metadata.deliveryCount }),
  },
);
