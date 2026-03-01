import { cachedFetch } from "../utils/cache.js";
import { config } from "../config.js";

const DEXSCREENER_BASE = "https://api.dexscreener.com";

/**
 * Fetch trending tokens on Base from multiple sources
 */
export async function fetchTrending() {
  return cachedFetch(
    "trending:base",
    async () => {
      // Fetch from DexScreener - top boosted tokens on Base
      const [trendingData, topGainers] = await Promise.allSettled([
        fetchDexScreenerTrending(),
        fetchBaseTopGainers(),
      ]);

      const trending =
        trendingData.status === "fulfilled" ? trendingData.value : [];
      const gainers =
        topGainers.status === "fulfilled" ? topGainers.value : [];

      // Merge and deduplicate by address
      const seen = new Set();
      const merged = [];

      for (const token of [...trending, ...gainers]) {
        const addr = token.address?.toLowerCase();
        if (addr && !seen.has(addr)) {
          seen.add(addr);
          merged.push(token);
        }
      }

      // Sort by volume
      merged.sort((a, b) => (b.volume_1h || 0) - (a.volume_1h || 0));

      return {
        trending_tokens: merged.slice(0, 25),
        total_results: merged.length,
        timestamp: new Date().toISOString(),
        source: "baseoracle:multi",
      };
    },
    config.cacheTtl.trending
  );
}

/**
 * DexScreener token profiles (boosted/trending)
 */
async function fetchDexScreenerTrending() {
  try {
    // Get latest token profiles on Base
    const resp = await fetch(
      `${DEXSCREENER_BASE}/token-profiles/latest/v1`,
      { headers: { Accept: "application/json" } }
    );

    if (!resp.ok) return [];

    const data = await resp.json();

    // Filter Base tokens
    const baseTokens = (data || [])
      .filter((t) => t.chainId === "base")
      .slice(0, 20);

    // Enrich with price data
    const enriched = [];
    for (const token of baseTokens) {
      try {
        const priceResp = await fetch(
          `${DEXSCREENER_BASE}/tokens/v1/base/${token.tokenAddress}`
        );
        if (priceResp.ok) {
          const priceData = await priceResp.json();
          const pair = priceData.pairs?.[0];
          if (pair) {
            enriched.push({
              name: pair.baseToken.name,
              symbol: pair.baseToken.symbol,
              address: pair.baseToken.address,
              price_usd: parseFloat(pair.priceUsd || "0"),
              market_cap: pair.marketCap || null,
              volume_24h: pair.volume?.h24 || 0,
              volume_1h: pair.volume?.h1 || 0,
              change_24h: pair.priceChange?.h24 || 0,
              change_1h: pair.priceChange?.h1 || 0,
              liquidity_usd: pair.liquidity?.usd || 0,
              txns_1h_buys: pair.txns?.h1?.buys || 0,
              txns_1h_sells: pair.txns?.h1?.sells || 0,
              created_at: pair.pairCreatedAt || null,
              dex: pair.dexId,
              source: "dexscreener:boosted",
            });
          }
        }
      } catch {
        // Skip failed enrichments
      }
    }

    return enriched;
  } catch {
    return [];
  }
}

/**
 * Fetch top gainers on Base via DexScreener search
 */
async function fetchBaseTopGainers() {
  try {
    // Search for recently created, high-volume Base pairs
    const resp = await fetch(
      `${DEXSCREENER_BASE}/latest/dex/pairs/base?sort=volume&order=desc`,
      { headers: { Accept: "application/json" } }
    );

    if (!resp.ok) return [];

    const data = await resp.json();
    const pairs = (data.pairs || []).slice(0, 25);

    return pairs.map((pair) => ({
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      address: pair.baseToken.address,
      price_usd: parseFloat(pair.priceUsd || "0"),
      market_cap: pair.marketCap || null,
      volume_24h: pair.volume?.h24 || 0,
      volume_1h: pair.volume?.h1 || 0,
      change_24h: pair.priceChange?.h24 || 0,
      change_1h: pair.priceChange?.h1 || 0,
      liquidity_usd: pair.liquidity?.usd || 0,
      txns_1h_buys: pair.txns?.h1?.buys || 0,
      txns_1h_sells: pair.txns?.h1?.sells || 0,
      created_at: pair.pairCreatedAt || null,
      dex: pair.dexId,
      source: "dexscreener:pairs",
    }));
  } catch {
    return [];
  }
}
