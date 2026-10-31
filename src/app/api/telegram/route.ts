import { webhookCallback } from "grammy";
import { createBot } from "@/lib/bot";
import { config } from "@/lib/config";

// Built on the first update rather than at import, so the build doesn't need the bot token.
let handle: ((req: Request) => Promise<Response>) | undefined;

// Telegram signs every webhook call with the secret we registered via setWebhook. A failed reply makes
// it deliver the update again, so a slow one (a cold start, the LLM) isn't failed after grammY's default
// 10 s: it gets up to 55 s, just under Telegram's own limit.
export function POST(req: Request) {
  handle ??= webhookCallback(createBot(), "std/http", { secretToken: config.telegram.webhookSecret || undefined, onTimeout: "return", timeoutMilliseconds: 55_000 });
  return handle(req);
}
