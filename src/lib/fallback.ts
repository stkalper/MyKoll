/**
 * Tatum answers 402 once the plan's credits are gone. Until they're back, reads go to public
 * endpoints instead (Binance, CoinGecko, Polymarket's own API, Sui GraphQL, Robinhood Chain's public
 * RPC), and every receipt names the source it really used. Tatum is asked again every 10 minutes,
 * so restored credits take over without a deploy.
 */
const RETRY = 10 * 60_000;
let outUntil = 0;

export const tatumOut = () => Date.now() < outUntil;

export const isOutOfCredits = (err: unknown) => /\b402\b/.test(String((err as Error)?.message ?? err));

export async function tatumOr<T>(tatum: () => Promise<T>, open: () => Promise<T>): Promise<T> {
  if (tatumOut()) return open();
  try {
    return await tatum();
  } catch (err) {
    if (!isOutOfCredits(err)) throw err;
    outUntil = Date.now() + RETRY;
    console.warn("Tatum is out of credits, using public endpoints");
    return open();
  }
}
