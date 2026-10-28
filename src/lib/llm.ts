import { config, llmEnabled } from "./config";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Minimal OpenAI-compatible chat completion call. Works with Groq, OpenRouter,
 * Together, Fireworks, a local Ollama (`http://localhost:11434/v1`) — any open model.
 */
export async function complete(messages: LlmMessage[], opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}) {
  if (!llmEnabled) throw new Error("LLM_API_KEY is not set");
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 700,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  // Reasoning models (Qwen3, DeepSeek-R1) may inline their chain of thought.
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Parses the first JSON object in a model reply. */
export function parseJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
