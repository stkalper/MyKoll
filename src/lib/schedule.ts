import { send } from "@vercel/queue";

export const DEADLINE_TOPIC = "call-deadlines";
const MAX_DELAY = 7 * 86_400 - 60;

/** How often a CS2 call on a Polymarket match is checked while the match plays out. */
export const MATCH_POLL_SECONDS = 15 * 60;
/** CS2 calls are judged ~4 h after the match starts; checking starts ~1.5 h in. */
const MATCH_CHECK_BEFORE_DEADLINE = 2.5 * 3_600_000;

/**
 * Wakes the bot at `at` for a call (Hobby cron only runs daily). Wake-ups further than a queue's
 * 7-day limit are re-queued by the consumer.
 * Only on Vercel: locally the polling script settles calls every minute.
 */
export async function wakeAt(callId: number, at: Date | string) {
  if (!process.env.VERCEL) return;
  const seconds = Math.ceil((new Date(at).getTime() - Date.now()) / 1000) + 5;
  const delaySeconds = Math.max(0, Math.min(MAX_DELAY, seconds));
  await send(DEADLINE_TOPIC, { callId }, { delaySeconds, retentionSeconds: 7 * 86_400 }).catch((err) =>
    console.error("could not schedule call", callId, err),
  );
}

/**
 * When to first look at a call: at its deadline, or for a CS2 call on a Polymarket match, while the
 * match is still on, because Polymarket can resolve it before the deadline, or long after it in a
 * long series. The queue consumer keeps checking those until they settle.
 */
export function firstCheck(call: { deadline: Date | string; market_ref: unknown }): Date {
  const deadline = new Date(call.deadline).getTime();
  if (!call.market_ref) return new Date(deadline);
  return new Date(Math.max(Date.now() + 10 * 60_000, deadline - MATCH_CHECK_BEFORE_DEADLINE));
}
