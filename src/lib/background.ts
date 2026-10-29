import { after } from "next/server";

/**
 * Runs work that the reply doesn't need (memory writes) after the response, so the chat
 * doesn't wait for it; on Vercel the function stays alive until it's done. Outside a request
 * (scripts) there's nothing to hand it to, so it just runs now.
 */
export function inBackground(task: () => Promise<unknown>) {
  const run = () => task().catch((err) => console.error("background task failed", err));
  try {
    after(run);
  } catch {
    void run();
  }
}
