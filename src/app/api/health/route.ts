import { MemWal } from "@mysten-incubation/memwal";
import { config } from "@/lib/config";
import { tatumOut } from "@/lib/fallback";
import { hyperliquidPrice } from "@/lib/hyperliquid";
import { upcomingCs2Matches } from "@/lib/polymarket";
import { robinhoodQuote } from "@/lib/robinhoodPrices";
import { suiTokenPriceUsd } from "@/lib/suiPrices";
import { priceUsd } from "@/lib/tatum";

const settle = async <T>(p: Promise<T>) => p.then((value) => ({ ok: true, value }), (err: Error) => ({ ok: false, error: err.message }));

/** Live check of every integration: Tatum Price API, Tatum Sui gRPC, Tatum Robinhood Chain RPC, Walrus Memory relayer. */
export async function GET() {
  const [priceApi, suiRpc, robinhoodRpc, prediction, walrus, hyperliquid] = await Promise.all([
    settle(priceUsd("BTC")),
    settle(suiTokenPriceUsd("WAL")),
    settle(robinhoodQuote("TSLA").then((q) => q?.price ?? null)),
    settle(upcomingCs2Matches()),
    settle(MemWal.create({ key: config.memwal.key, accountId: config.memwal.accountId, serverUrl: config.memwal.serverUrl }).health()),
    settle(hyperliquidPrice("FARTCOIN")),
  ]);
  return Response.json(
    {
      tatumPriceApi: { BTC: priceApi },
      tatumSuiGrpc: { WAL_onchain: suiRpc },
      tatumRobinhoodRpc: { TSLA_onchain: robinhoodRpc },
      tatumPredictionApi: { upcoming_cs2_matches: prediction },
      walrusMemory: walrus,
      // Prices coins the other sources don't list, with no key.
      hyperliquid: { FARTCOIN: hyperliquid },
      // True while Tatum is out of credits and the reads above came from public endpoints.
      publicFallback: tatumOut(),
    },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
