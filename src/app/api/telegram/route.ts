import { webhookCallback } from "grammy";
import { createBot } from "@/lib/bot";
import { config } from "@/lib/config";

// Built on the first update rather than at import, so the build doesn't need the bot token.
let handle: ((req: Request) => Promise<Response>) | undefined;

// Telegram signs every webhook call with the secret we registered via setWebhook.
export function POST(req: Request) {
  handle ??= webhookCallback(createBot(), "std/http", { secretToken: config.telegram.webhookSecret || undefined });
  return handle(req);
}
