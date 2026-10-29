// The parts of the bot that decide things, tested without Telegram, a database or the network.
//   npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claim, mightBeCall, usd, type CallRow } from "./calls";
import { habitOf } from "./habits";
import { segmentsOf, trackRecordOf, trustOn } from "./learning";
import { poolPrice } from "./suiPrices";
import { gap } from "./tatum";

const DAY = 86_400_000;
const call = (over: Partial<CallRow>): CallRow =>
  ({
    id: 1, chat_id: "-1", chat_title: null, author_id: "7", author_name: "@ivan", market: "crypto", subject: "SUI", opponent: null,
    direction: "up", target: null, entry_price: 1, quote: "", made_at: new Date(0), deadline: new Date(3 * DAY), status: "open",
    final_price: null, result_note: null, hidden: false, price_source: null, entry_proof: null, entry_check: null, final_proof: null, final_check: null,
    ...over,
  }) as CallRow;

describe("spotting calls", () => {
  it("lets through predictions in English, Ukrainian and Russian", () => {
    for (const text of ["SUI to $5 by Friday", "btc dumps under 90k this week", "біток до 90к до неділі", "NaVi рознесуть FaZe сьогодні", "эфир упадет до 2000", "WAL 0.05 by friday"])
      assert.equal(mightBeCall(text), true, text);
  });
  it("skips chatter, commands and coins without a prediction", () => {
    for (const text of ["good morning everyone", "/call SUI to $5", "BTC", "lol"]) assert.equal(mightBeCall(text), false, text);
  });
});

describe("describing calls", () => {
  it("spells out each kind of claim", () => {
    assert.equal(claim(call({ direction: "above", target: 90000, subject: "BTC" })), "BTC above $90,000");
    assert.equal(claim(call({ direction: "up", entry_price: 186.4, subject: "SOL" })), "SOL up from $186.40");
    assert.equal(claim(call({ market: "cs2", subject: "NaVi", opponent: "FaZe", direction: "win" })), "NaVi to beat FaZe");
  });
  it("formats small and large prices", () => {
    assert.equal(usd(81705.4), "$81,705");
    assert.equal(usd(0.0341), "$0.0341");
  });
});

describe("the learning loop", () => {
  it("files a call under its kinds", () => {
    assert.deepEqual(segmentsOf(call({ subject: "WAL", direction: "above", deadline: new Date(DAY / 2) })), [
      "crypto calls", "WAL calls", "Sui tokens", "bullish calls", "calls under a day",
    ]);
    assert.deepEqual(segmentsOf(call({ market: "cs2", subject: "NaVi" })), ["CS2 picks", "NaVi picks"]);
  });

  it("finds strengths and weaknesses once there are two calls of a kind", () => {
    const record = trackRecordOf([
      call({ subject: "WAL", status: "loss" }),
      call({ subject: "DEEP", status: "loss" }),
      call({ subject: "BTC", status: "win" }),
      call({ subject: "ETH", status: "win" }),
    ])!;
    assert.equal(record.hits, 2);
    assert.ok(record.strong.some((s) => s.segment === "majors"));
    assert.ok(record.weak.some((s) => s.segment === "Sui tokens"));
    assert.match(record.summary, /^@ivan is 2\/4 right; strong on .*majors 2\/2.*; weak on .*Sui tokens 0\/2/);
  });

  it("trusts a member most on the coin itself, smoothed so one call isn't certainty", () => {
    const record = trackRecordOf([call({ status: "win" }), call({ status: "win" }), call({ status: "win" }), call({ subject: "BTC", status: "loss" })])!;
    assert.deepEqual(trustOn(record, call({})), { weight: 4 / 5, basis: "3/3 on SUI calls" });
    assert.deepEqual(trustOn(undefined, call({})), { weight: 0.5, basis: "no record yet" });
  });
});

describe("habits", () => {
  it("stops asking after three confirms, asks first after two rejections", () => {
    assert.equal(habitOf([true, true, true]), "trusted");
    assert.equal(habitOf([true, true]), null);
    assert.equal(habitOf([false, true, false]), "unsure");
    assert.equal(habitOf([false, true, true]), null);
  });
});

describe("prices", () => {
  it("turns a Cetus Q64.64 sqrt price into a price in whole tokens", () => {
    // SUI (9 decimals) at $0.95 in USDC (6 decimals): raw price is 0.95e-3.
    const sqrt = BigInt(Math.round(Math.sqrt(0.95e-3) * 2 ** 64)).toString();
    assert.ok(Math.abs(poolPrice(sqrt, 9, 6) - 0.95) < 1e-9);
  });
  it("measures how far two sources are apart", () => {
    assert.ok(Math.abs(gap(100, 102) - 0.02) < 1e-12);
  });
});
