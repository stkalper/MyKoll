import { hiddenIds, leaderboard, when } from "./calls";
import { llmEnabled } from "./config";
import { complete } from "./llm";
import { callIdsIn, recall } from "./memory";

/** Answers a question about the chat's past calls from its Walrus Memory. */
export async function answer(chatId: number, question: string): Promise<string> {
  const [memories, hidden, crypto, cs2] = await Promise.all([
    recall(chatId, question, 12),
    hiddenIds(chatId),
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
  ]);
  const visible = memories.filter((m) => !callIdsIn(m.text).some((id) => hidden.has(id)));
  if (!visible.length) return "I don't remember anything about that in this chat yet.";
  if (!llmEnabled) return visible.map((m) => `• ${m.text}`).join("\n");

  const board = (name: string, rows: typeof crypto) =>
    rows.length ? `${name}: ${rows.map((r) => `${r.author_name} ${r.hits}/${r.calls}`).join(", ")}` : `${name}: no settled calls yet`;

  return complete(
    [
      {
        role: "system",
        content: `You are Receipts, the memory of a Telegram group chat. People make crypto and CS2 calls; you remember who said what and whether they were right.
Answer the question using ONLY the memories below. Quote people's exact words, give dates, and say if a call was right or wrong.
If the memories don't answer it, say you don't remember that. Be short and a little playful, like a friend in the chat. No markdown.
Reply in the language of the question.

Settled calls so far — ${board("crypto", crypto)}; ${board("CS2", cs2)}.
Today is ${when(new Date())}.

Memories:
${visible.map((m) => `- ${m.text}`).join("\n")}`,
      },
      { role: "user", content: question },
    ],
    { temperature: 0.4, maxTokens: 400 },
  );
}
