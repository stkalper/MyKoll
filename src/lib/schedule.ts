import { send } from "@vercel/queue";

export const DEADLINE_TOPIC = "call-deadlines";
const MAX_DELAY = 7 * 86_400 - 60;

/** How often the bot looks for results on its own while any call is still running. */
export const SWEEP_SECONDS = 15 * 60;
/** How often a CS2 call on a Polymarket match is checked while the match plays out. */
export const MATCH_POLL_SECONDS = SWEEP_SECONDS;
/** CS2 calls are judged ~4 h after the match starts; checking starts ~1.5 h in. */
const MATCH_CHECK_BEFORE_DEADLINE = 2.5 * 3_600_000;

export type WakeMessage = { callId: number } | { sweep: true };

/**
 * Wakes the bot at `at` for a call (Hobby cron only runs daily). Wake-ups further than a queue's
 * 7-day limit are re-queued by the consumer.
 * Only on Vercel: locally the polling script settles calls every minute.
 */
export async function wakeAt(callId: number, at: Date | string) {
  if (!process.env.VERCEL) return;
  const seconds = Math.ceil((new Date(at).getTime() - Date.now()) / 1000) + 5;
  const delaySeconds = Math.max(0, Math.min(MAX_DELAY, seconds));
  await send(DEADLINE_TOPIC, { callId } satisfies WakeMessage, { delaySeconds, retentionSeconds: 7 * 86_400 }).catch((err) =>
    console.error("could not schedule call", callId, err),
  );
}

/**
 * Keeps one sweep queued for the next quarter hour, so results reach the chats on their own even
 * when nobody writes: a target hit early, a match Polymarket resolves late. Everyone may ask for the
 * next sweep (a new call, chat traffic, the daily cron, the sweep itself); the idempotency key per
 * quarter hour keeps it to one. The sweep stops asking once no call is left running.
 */
export async function nextSweep() {
  if (!process.env.VERCEL) return;
  const slot = Math.ceil((Date.now() + 1000) / (SWEEP_SECONDS * 1000)) * SWEEP_SECONDS * 1000;
  const delaySeconds = Math.ceil((slot - Date.now()) / 1000) + 5;
  await send(DEADLINE_TOPIC, { sweep: true } satisfies WakeMessage, { delaySeconds, retentionSeconds: 3_600, idempotencyKey: `sweep-${slot}` }).catch((err) => {
    // Someone queued this quarter hour's sweep already.
    if (!/duplicate/i.test(String(err?.name ?? err))) console.error("could not queue the sweep", err);
  });
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
