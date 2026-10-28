function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export const config = {
  /** Public HTTPS URL of the deployment, used for the Mini App button and webhook. */
  publicUrl: env("PUBLIC_URL").replace(/\/$/, ""),
  /** Postgres (Neon) connection string. Without it a local PGlite database in .data/ is used. */
  databaseUrl: env("DATABASE_URL"),
  /** Default zone for reading deadlines like "by Friday". */
  timezone: env("TIMEZONE", "Europe/Kyiv"),
  /** Shared secret for cron/queue endpoints. */
  cronSecret: env("CRON_SECRET"),

  telegram: {
    botToken: env("TELEGRAM_BOT_TOKEN"),
    /** Telegram echoes this in X-Telegram-Bot-Api-Secret-Token on every webhook call. */
    webhookSecret: env("TELEGRAM_WEBHOOK_SECRET"),
  },

  tatum: {
    apiKey: env("TATUM_API_KEY"),
    suiGrpcHost: env("TATUM_SUI_GRPC_HOST", "sui-mainnet-grpc.gateway.tatum.io:443"),
  },

  memwal: {
    key: env("MEMWAL_PRIVATE_KEY"),
    accountId: env("MEMWAL_ACCOUNT_ID"),
    serverUrl: env("MEMWAL_SERVER_URL", "https://relayer.memory.walrus.xyz"),
    /** Each chat gets its own namespace: `${prefix}:chat:${chatId}` */
    namespacePrefix: env("MEMWAL_NAMESPACE_PREFIX", "receipts"),
  },

  llm: {
    /** Any OpenAI-compatible endpoint: Groq, OpenRouter, Together, Ollama, ... */
    baseUrl: env("LLM_BASE_URL", "https://api.groq.com/openai/v1").replace(/\/$/, ""),
    apiKey: env("LLM_API_KEY"),
    model: env("LLM_MODEL", "qwen/qwen3.8-27b"),
  },
};

export const memwalEnabled = Boolean(config.memwal.key && config.memwal.accountId);
export const llmEnabled = Boolean(config.llm.apiKey);
