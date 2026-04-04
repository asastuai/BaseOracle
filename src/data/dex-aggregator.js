import { cachedFetch } from "../utils/cache.js";

const DEXSCREENER = "https://api.dexscreener.com";

/**
 * DEX Aggregator: find best swap route across all DEXs on a chain
 */
export async function findBestRoute(tokenIn, tokenOut, amount, chain = "base") {
  if (!tokenIn || !tokenOut) {
    return { error: "Both tokenIn and tokenOut required (symbol or address)" };
  }

  const cacheKey = `route:${chain}:${tokenIn}:${tokenOut}:${amount || "any"}`;

  return cachedFetch(cacheKey, async () => {
    // Search for pairs involving both tokens
    const [inRes, outRes] = await Promise.allSettled([
      fetch(`${DEXSCREENER}/latest/dex/search?q=${encodeURIComponent(tokenIn)}`).then(r => r.json()),
      fetch(`${DEXSCREENER}/latest/dex/search?q=${encodeURIComponent(tokenOut)}`).then(r => r.json()),
    ]);

    const inPairs = (inRes.status === "fulfilled" ? inRes.value.pairs || [] : []).filter(p => p.chainId === chain);
    const outPairs = (outRes.status === "fulfilled" ? outRes.value.pairs || [] : []).filter(p => p.chainId === chain);

    // Find direct pairs
    const directPairs = inPairs.filter(p =>
      (p.baseToken?.symbol?.toUpperCase() === tokenIn.toUpperCase() && p.quoteToken?.symbol?.toUpperCase() === tokenOut.toUpperCase()) ||
      (p.quoteToken?.symbol?.toUpperCase() === tokenIn.toUpperCase() && p.baseToken?.symbol?.toUpperCase() === tokenOut.toUpperCase())
    );

    // Sort by liquidity
    const routes = directPairs
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
      .slice(0, 5)
      .map((p, i) => ({
        rank: i + 1,
        dex: p.dexId,
        pair: p.pairAddress,
        price: parseFloat(p.priceUsd || "0"),
        liquidity_usd: p.liquidity?.usd || 0,
        volume_24h: p.volume?.h24 || 0,
        price_impact_est: p.liquidity?.usd > 0 && amount
          ? parseFloat((parseFloat(amount) / p.liquidity.usd * 100).toFixed(4))
          : null,
        fee_tier: p.labels?.includes("v3") ? "dynamic" : "0.3%",
      }));

    // Find hop routes (tokenIn → WETH/USDC → tokenOut)
    const hopTokens = ["WETH", "USDC", "USDT", "WBNB"];
    const hopRoutes = [];

    for (const hop of hopTokens) {
      const legA = inPairs.find(p =>
        p.baseToken?.symbol?.toUpperCase() === tokenIn.toUpperCase() &&
        p.quoteToken?.symbol?.toUpperCase() === hop
      );
      const legB = outPairs.find(p =>
        p.baseToken?.symbol?.toUpperCase() === tokenOut.toUpperCase() &&
        p.quoteToken?.symbol?.toUpperCase() === hop
      );

      if (legA && legB) {
        hopRoutes.push({
          path: `${tokenIn} → ${hop} → ${tokenOut}`,
          hop_token: hop,
          leg_a: { dex: legA.dexId, liquidity: legA.liquidity?.usd || 0 },
          leg_b: { dex: legB.dexId, liquidity: legB.liquidity?.usd || 0 },
          min_liquidity: Math.min(legA.liquidity?.usd || 0, legB.liquidity?.usd || 0),
        });
      }
    }

    return {
      tokenIn,
      tokenOut,
      chain,
      direct_routes: routes,
      hop_routes: hopRoutes.sort((a, b) => b.min_liquidity - a.min_liquidity).slice(0, 3),
      best: routes[0] || hopRoutes[0] || null,
      timestamp: new Date().toISOString(),
      source: "baseoracle:dexscreener",
    };
  }, 15);
}
