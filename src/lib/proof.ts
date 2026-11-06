/**
 * Which pool state an on-chain price was read from, so anyone can check it on an explorer.
 * Calls logged before Robinhood Chain support have no `chain`: those are Sui reads.
 */
export interface PoolRead {
  chain?: "sui" | "robinhood";
  pool: string;
  /** Sui: the pool object's version. */
  version?: string;
  /** Sui: the transaction that last changed the pool, i.e. the one that set this price. */
  tx?: string | null;
  /** Robinhood Chain: the block the pool was read at. */
  block?: string;
}

/**
 * An explorer page for a price: the Sui transaction that set it, or the Robinhood Chain pool
 * (its trades around the recorded block show the price; `slot0` at that block gives it exactly).
 */
export function proofUrl(read: PoolRead): string {
  if (read.chain === "robinhood") return `https://robinhoodchain.blockscout.com/address/${read.pool}`;
  return read.tx ? `https://suiscan.xyz/mainnet/tx/${read.tx}` : `https://suiscan.xyz/mainnet/object/${read.pool}`;
}

/** A memory's encrypted blob on Walrus: it shows when it was sealed, not what it says. */
export const blobUrl = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

/** Where a price came from, in a few words, for the receipt pages. */
export const priceLabel = (source?: string) =>
  (
    ({
      "sui-onchain": "on-chain · Tatum Sui RPC",
      "robinhood-onchain": "Robinhood Chain · Tatum RPC",
      binance: "Binance public API",
      coingecko: "CoinGecko public API",
      hyperliquid: "Hyperliquid public API",
      "sui-public": "on-chain · public Sui GraphQL",
      "robinhood-public": "Robinhood Chain · public RPC",
    }) as Record<string, string>
  )[source ?? ""] ?? "Tatum Price API";

/** The button or link text for a proof, naming the chain. */
export const proofLabel = (read: PoolRead) => (read.chain === "robinhood" ? "Robinhood Chain" : "Sui");
