import { cachedFetch } from "../utils/cache.js";

const ANKR_API = "https://rpc.ankr.com/multichain";

/**
 * Portfolio tracker: all token balances + total value for a wallet
 */
export async function fetchPortfolio(address, chain = "base") {
  if (!address || !address.startsWith("0x")) {
    return { error: "Valid wallet address required (0x...)" };
  }

  const chainMap = { base: "base", bsc: "bsc", ethereum: "eth" };
  const ankrChain = chainMap[chain];
  if (!ankrChain) return { error: `Unsupported chain: ${chain}` };

  const cacheKey = `portfolio:${chain}:${address.toLowerCase()}`;

  return cachedFetch(cacheKey, async () => {
    // Use Ankr's free multichain API
    const res = await fetch(ANKR_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ankr_getAccountBalance",
        params: { walletAddress: address, blockchain: [ankrChain] },
        id: 1,
      }),
    });

    const data = await res.json();
    const assets = data.result?.assets || [];

    let totalUsd = 0;
    const tokens = assets
      .filter(a => a.balanceUsd > 0.01)
      .sort((a, b) => b.balanceUsd - a.balanceUsd)
      .map(a => {
        totalUsd += a.balanceUsd;
        return {
          symbol: a.tokenSymbol,
          name: a.tokenName,
          address: a.contractAddress || "native",
          balance: parseFloat(a.balance),
          balance_usd: parseFloat(a.balanceUsd.toFixed(2)),
          price_usd: parseFloat(a.tokenPrice?.toFixed(6) || "0"),
          type: a.tokenType || "ERC20",
          logo: a.thumbnail || null,
        };
      });

    return {
      wallet: address,
      chain,
      total_value_usd: parseFloat(totalUsd.toFixed(2)),
      token_count: tokens.length,
      tokens,
      timestamp: new Date().toISOString(),
      source: "baseoracle:ankr",
    };
  }, 30);
}
