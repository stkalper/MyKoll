import { send } from "@vercel/queue";

export const DEADLINE_TOPIC = "call-deadlines";
const MAX_DELAY = 7 * 86_400 - 60;

/**
 * Wakes the bot when a call's deadline arrives (Hobby cron only runs daily).
 * Deadlines further than a queue's 7-day limit are re-queued by the consumer.
 * Only on Vercel: locally the polling script settles calls every minute.
 */
export async function wakeAt(callId: number, deadline: Date | string) {
  if (!process.env.VERCEL) return;
  const seconds = Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000) + 5;
  const delaySeconds = Math.max(0, Math.min(MAX_DELAY, seconds));
  await send(DEADLINE_TOPIC, { callId }, { delaySeconds, retentionSeconds: 7 * 86_400 }).catch((err) =>
    console.error("could not schedule call", callId, err),
  );
}
