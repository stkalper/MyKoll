// What the "What I recalled" button shows for a question, read from a chat's real Walrus Memory
// (recall only, nothing written; local database).
//   npx tsx --env-file=.env.local scripts/try-recalled.mts -5318326021 "who called furia?"
import "./local-db.mts";
import { answer, sourcesText } from "../src/lib/ask";

const [chat = "-5318326021", question = "who called furia?"] = process.argv.slice(2);
const { text, sources } = await answer(Number(chat), question);
console.log(`answer: ${text}\n`);
console.log(sourcesText(sources));
process.exit(0);
