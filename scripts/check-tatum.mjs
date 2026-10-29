// Smoke test for the Tatum endpoints MyKoll relies on. Run: node --env-file=.env.local scripts/check-tatum.mjs
import { ChannelCredentials } from "@grpc/grpc-js";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { SuiGrpcClient } from "@mysten/sui/grpc";

const key = process.env.TATUM_API_KEY;

const price = await fetch("https://api.tatum.io/v4/data/rate/symbol?symbol=SUI&basePair=USD", {
  headers: { "x-api-key": key },
}).then((r) => r.json());
console.log("price", price.symbol, price.value, price.source);

// Tatum speaks native gRPC (application/grpc), not gRPC-web, so use an HTTP/2 transport.
const sui = new SuiGrpcClient({
  network: "mainnet",
  transport: new GrpcTransport({
    host: "sui-mainnet-grpc.gateway.tatum.io:443",
    channelCredentials: ChannelCredentials.createSsl(),
    meta: { "x-api-key": key },
  }),
});
const info = await sui.ledgerService.getServiceInfo({});
console.log("sui grpc", info.response.chain, "checkpoint", info.response.checkpointHeight);
const coin = await sui.core.getCoinMetadata({ coinType: "0x2::sui::SUI" });
console.log("coin metadata", coin.coinMetadata?.symbol, coin.coinMetadata?.decimals);
