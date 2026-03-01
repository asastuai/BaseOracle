import { cachedFetch } from "../utils/cache.js";
import { config } from "../config.js";

const DEXSCREENER_BASE = "https://api.dexscreener.com";

/**
 * Fetch price data for a token on Base
 * @param {string} query - Token symbol, name, or contract address
 */
export async function fetchTokenPrice(query) {
  if (!query) {
    return { error: "Missing 'token' query parameter" };
  }

  const cacheKey = `price:${query.toLowerCase()}`;

  return cachedFetch(
    cacheKey,
    async () => {
      // If it looks like an address, search by address
      const isAddress = query.startsWith("0x") && query.length === 42;

      let url;
      if (isAddress) {
        url = `${DEXSCREENER_BASE}/tokens/v1/base/${query}`;
      } else {
        url = `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`;
      }

      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!resp.ok) {
        return { error: `DexScreener API error: ${resp.status}` };
      }

      const data = await resp.json();

      // Filter for Base chain pairs
      const pairs = (data.pairs || []).filter(
        (p) => p.chainId === "base"
      );

      if (!pairs.length) {
        return { error: `Token "${query}" not found on Base` };
      }

      // Return the highest liquidity pair
      const top = pairs.sort(
        (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      return {
        token: top.baseToken.symbol,
        name: top.baseToken.name,
        address: top.baseToken.address,
        price_usd: parseFloat(top.priceUsd || "0"),
        market_cap: top.marketCap || null,
        fdv: top.fdv || null,
        volume_24h: top.volume?.h24 || 0,
        volume_6h: top.volume?.h6 || 0,
        volume_1h: top.volume?.h1 || 0,
        change_24h: top.priceChange?.h24 || 0,
        change_6h: top.priceChange?.h6 || 0,
        change_1h: top.priceChange?.h1 || 0,
        liquidity_usd: top.liquidity?.usd || 0,
        pair_address: top.pairAddress,
        dex: top.dexId,
        txns_24h: {
          buys: top.txns?.h24?.buys || 0,
          sells: top.txns?.h24?.sells || 0,
        },
        created_at: top.pairCreatedAt || null,
        timestamp: new Date().toISOString(),
        source: "baseoracle:dexscreener",
      };
    },
    config.cacheTtl.prices
  );
}

/**
 * Fetch multiple token prices at once
 * @param {string[]} tokens - Array of token symbols/addresses
 */
export async function fetchMultiplePrices(tokens) {
  const results = await Promise.allSettled(
    tokens.map((t) => fetchTokenPrice(t))
  );

  return results.map((r, i) => ({
    query: tokens[i],
    ...(r.status === "fulfilled" ? r.value : { error: r.reason?.message }),
  }));
}
