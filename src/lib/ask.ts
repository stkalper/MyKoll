import { hiddenIds, leaderboard, when } from "./calls";
import { llmEnabled } from "./config";
import { trackRecords } from "./learning";
import { complete } from "./llm";
import { callIdsIn, recall, type Recalled } from "./memory";
import { spellTeams } from "./polymarket";
import { blobUrl } from "./proof";
import { memoryScorecard, scorecardLine } from "./scorecard";

/**
 * A question about past calls put to the room rather than to the bot ("who called nemiga?",
 * "хто казав про SUI"). It's the bot's job to answer those, so it does without being tagged. Kept
 * to how such questions start, so ordinary chat ("who's watching tonight?") is left alone.
 */
const RECALL =
  /^(?:who(?:'s| is| was)? (?:called|calls|said|says|picked|backed|bet|was right|right about|got it right)|what did \S+ (?:say|call|pick)|хто (?:казав|кликав|колив|ставив|писав|говорив|вгадав|був правий)|що (?:казав|писав|говорив)|кто (?:говорил|ставил|писал|угадал))(?!\s+(?:me|you|him|her|them|us)(?![\p{L}]))(?=[\s?!.,]|$)/iu;

export const recallQuestion = (text: string) => RECALL.test(text.trim());

/** A memory as the answer used it: its words, and the Walrus blob it is sealed in. */
export type Source = Pick<Recalled, "text" | "blobId">;

export interface Answer {
  text: string;
  /** The memories recalled for this answer, so the chat can see what it was based on. */
  sources: Source[];
}

/** Memories the bot recalls but never shows or answers from (see `answer`). */
const UK_LETTERS = /[іїєґ]/iu;
const RU_LETTERS = /[ыэъё]/iu;
const UK_WORDS = /(?<![\p{L}])(хто|що|чи|як|коли|який|яка|яке|які|скільки|найкращ\p{L}*|ще|та|мені|був|була|було|правий|права|вгадав|колив|кол|коли)(?![\p{L}])/iu;
const RU_WORDS = /(?<![\p{L}])(кто|что|как|когда|какой|какая|какие|сколько|лучш\p{L}*|еще|мне|был|была|было|прав|угадал|колил)(?![\p{L}])/iu;

/**
 * The language to answer a question in, decided here rather than by the model: the memories are
 * full of quotes in Russian and surzhyk ("изи для фуріа"), and the model then drifts into Russian
 * on a short Ukrainian question that has no і, ї or є. Mostly Latin letters is English; Cyrillic
 * is Ukrainian unless only Russian letters or words show.
 */
export function replyLanguage(text: string): "English" | "Ukrainian" | "Russian" {
  const cyrillic = (text.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  const latin = (text.match(/[a-z]/giu) ?? []).length;
  if (cyrillic <= latin) return "English";
  if (UK_LETTERS.test(text)) return "Ukrainian";
  if (RU_LETTERS.test(text)) return "Russian";
  return RU_WORDS.test(text) && !UK_WORDS.test(text) ? "Russian" : "Ukrainian";
}

export const shownMemory = (text: string, hidden: Set<number>) =>
  !text.startsWith("[TRACK RECORD") && !text.startsWith("[NOT A CALL") && !callIdsIn(text).some((id) => hidden.has(id));

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The memories behind an answer, each with a link to its blob on Walrus Mainnet (Telegram HTML). */
export function sourcesText(sources: Source[]): string {
  if (!sources.length) return "Nothing I recalled for that answer is still shown: the calls behind it were hidden.";
  // Long ids (Polymarket markets, pools) say nothing in a chat; the receipt links them anyway.
  const short = (t: string) => {
    const s = t.replace(/0x[0-9a-f]{10,}/gi, (id) => `${id.slice(0, 8)}…`);
    return s.length > 200 ? `${s.slice(0, 199)}…` : s;
  };
  const lines = sources.map((s, i) => `${i + 1}. ${escHtml(short(s.text))}${s.blobId ? ` · <a href="${blobUrl(s.blobId)}">sealed on Walrus</a>` : ""}`);
  // Telegram caps a message at 4096 characters of visible text; link targets don't count.
  const footer = "<i>The blobs are encrypted, so a link shows when a memory was sealed, not what it says.</i>";
  let shown = lines.length;
  const visible = (n: number) => lines.slice(0, n).join("\n").replace(/<a href="[^"]*">/g, "").length;
  while (shown > 1 && visible(shown) > 3600) shown--;
  return [
    `🧠 <b>What I recalled from this chat's Walrus Memory</b> (${sources.length})`,
    "",
    ...lines.slice(0, shown),
    ...(shown < lines.length ? [`…and ${lines.length - shown} more`] : []),
    "",
    footer,
  ].join("\n");
}

/** Answers a question about the chat's past calls from its Walrus Memory. */
export async function answer(chatId: number, asked: string): Promise<Answer> {
  const question = spellTeams(asked);
  const [memories, hidden, crypto, cs2, records, scorecard] = await Promise.all([
    recall(chatId, question, 12),
    hiddenIds(chatId),
    leaderboard(chatId, "crypto"),
    leaderboard(chatId, "cs2"),
    trackRecords(chatId),
    memoryScorecard(chatId),
  ]);
  // Older track records are superseded by the current ones below, so they don't argue with them;
  // misreads are the bot's own mistakes, not something anyone said.
  const visible = memories.filter((m) => shownMemory(m.text, hidden));
  const sources = visible.map(({ text, blobId }) => ({ text, blobId }));
  if (!visible.length && !records.size) return { text: "I don't remember anything about that in this chat yet.", sources };
  if (!llmEnabled) return { text: visible.map((m) => `• ${m.text}`).join("\n"), sources };

  const board = (name: string, rows: typeof crypto) =>
    rows.length ? `${name}: ${rows.map((r) => `${r.author_name} ${r.hits}/${r.calls}`).join(", ")}` : `${name}: no settled calls yet`;
  const learned = [...records.values()].map((r) => `- ${r.summary}`).join("\n") || "- nothing yet";

  const language = replyLanguage(asked);
  const text = await complete(
    [
      {
        role: "system",
        content: `You are MyKoll, the memory of a Telegram group chat. People make crypto and CS2 calls; you remember who said what and whether they were right.
Answer the question using ONLY the memories and track records below. Quote people's exact words, give dates, and say if a call was right or wrong.
CALL entries are predictions, RESULT entries say how they ended, REASON entries are the author's own explanation of why they made the call, HABIT entries say how you changed the way you handle someone's calls, RECORD CHANGE entries say when a result changed what you think someone is good or bad at.
A "record at the time" inside a CALL entry is how things stood back then; for how good someone is now, use the current track records below.
When asked who to trust, or how good someone is, use the track records: they say where each person tends to be right or wrong.
If nothing below answers it, say you don't remember that. Be short and a little playful, like a friend in the chat. No markdown.
Reply in ${language}, whatever language the memories and quotes are in (quote people's words as they wrote them).

Settled calls so far — ${board("crypto", crypto)}; ${board("CS2", cs2)}.
What you have learned about each member (current):
${learned}
How good your memory has been at predicting who is right: ${scorecardLine(scorecard) ?? `too early to say (${scorecard.calls} settled calls)`}
Today is ${when(new Date())}.

Memories:
${visible.map((m) => `- ${m.text}`).join("\n")}`,
      },
      { role: "user", content: `${question}

(Answer in ${language}.)` },
    ],
    { temperature: 0.4, maxTokens: 400 },
  );
  return { text, sources };
}
