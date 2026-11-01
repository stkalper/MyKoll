import { handleCallback } from "@vercel/queue";
import { Bot } from "grammy";
import { announceResolutions } from "@/lib/bot";
import { anyTargetReached } from "@/lib/calls";
import { config } from "@/lib/config";
import type { WatchMessage } from "@/lib/schedule";

/**
 * A price check between sweeps. It carries its own targets and only asks Tatum, so the database can
 * sleep; only a target that was reached wakes it, to settle the call and post the result. A missed
 * check isn't worth retrying, since the next one comes in three minutes.
 */
export const POST = handleCallback(
  async ({ targets }: WatchMessage) => {
    if (await anyTargetReached(targets)) await announceResolutions(new Bot(config.telegram.botToken));
  },
  { retry: () => ({ acknowledge: true }) },
);
