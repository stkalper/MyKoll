// Quick check of call extraction: npx tsx --env-file=.env.local scripts/try-extract.mts
import { extractCall, mightBeCall } from "../src/lib/calls";

const samples = [
  "SUI to $5 by Friday",
  "біток впаде нижче 90к до неділі",
  "NaVi сьогодні рознесуть FaZe",
  "sol looks good ngl",
  "who's watching the major tonight?",
  "eth up by tomorrow evening",
  "Spirit beat Vitality, easy",
  "тесла до 450 до пʼятниці",
  "NVDA under 200 by end of month",
  "PONS to 50 cents this week",
  "TRX long, entry 0.33, TP 0.36, SL 0.31",
  "лонг трх від 0.34, тейк 0.37",
  "trx шорт, ціль 0.30 до неділі",
  "БТС 102к завтра",
  "btc 70k tomorrow",
  "СУІ вище 1 бакса через 5 годин",
  "Сигнал: TRX лонг від 0.34, тейк 0.37, стоп 0.32. Чому: пробили денний опір на об'ємі, фандинг негативний, а Justin Sun знову скуповує. Тримаю до кінця тижня.",
];
for (const s of samples) {
  const pre = mightBeCall(s);
  const r = pre ? await extractCall(s) : null;
  const d = r && !("reason" in r) ? r : null;
  console.log(pre ? "?" : "-", JSON.stringify(s), "=>", d ? `${d.market} ${d.subject}${d.opponent ? " vs " + d.opponent : ""} ${d.direction} ${d.target ?? ""} by ${d.deadline}` : "no call");
  if (d && (d.quote !== s || d.why)) console.log("    quote:", JSON.stringify(d.quote), "· why:", JSON.stringify(d.why));
}
