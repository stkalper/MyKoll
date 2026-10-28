import { MemWal } from "@mysten-incubation/memwal";
import { config } from "@/lib/config";
import { suiTokenPriceUsd } from "@/lib/suiPrices";
import { priceUsd } from "@/lib/tatum";

const settle = async <T>(p: Promise<T>) => p.then((value) => ({ ok: true, value }), (err: Error) => ({ ok: false, error: err.message }));

/** Live check of every integration: Tatum Price API, Tatum Sui gRPC, Walrus Memory relayer. */
export async function GET() {
  const [priceApi, suiRpc, walrus] = await Promise.all([
    settle(priceUsd("BTC")),
    settle(suiTokenPriceUsd("WAL")),
    settle(MemWal.create({ key: config.memwal.key, accountId: config.memwal.accountId, serverUrl: config.memwal.serverUrl }).health()),
  ]);
  return Response.json(
    { tatumPriceApi: { BTC: priceApi }, tatumSuiGrpc: { WAL_onchain: suiRpc }, walrusMemory: walrus },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
