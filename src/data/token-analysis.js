import { cachedFetch } from "../utils/cache.js";

const DEXSCREENER = "https://api.dexscreener.com";
const GOPLUSLABS = "https://api.gopluslabs.io/api/v1";

/**
 * Full token analysis: price + security + holders + liquidity
 * Combines DexScreener + GoPlus for rug detection
 */
export async function analyzeToken(address, chain = "base") {
  if (!address || !address.startsWith("0x")) {
    return { error: "Valid token address required (0x...)" };
  }

  const chainMap = { base: "8453", bsc: "56", ethereum: "1" };
  const chainId = chainMap[chain] || "8453";
  const cacheKey = `analysis:${chain}:${address.toLowerCase()}`;

  return cachedFetch(cacheKey, async () => {
    // Parallel fetch: price data + security audit
    const [priceRes, securityRes] = await Promise.allSettled([
      fetch(`${DEXSCREENER}/tokens/v1/${chain}/${address}`).then(r => r.json()),
      fetch(`${GOPLUSLABS}/token_security/${chainId}?contract_addresses=${address}`).then(r => r.json()),
    ]);

    const pairs = priceRes.status === "fulfilled" ? (priceRes.value.pairs || []) : [];
    const topPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

    const security = securityRes.status === "fulfilled"
      ? securityRes.value?.result?.[address.toLowerCase()] || {}
      : {};

    const risks = [];
    if (security.is_honeypot === "1") risks.push("HONEYPOT");
    if (security.is_open_source === "0") risks.push("NOT_OPEN_SOURCE");
    if (security.can_take_back_ownership === "1") risks.push("OWNERSHIP_TAKEBACK");
    if (security.is_proxy === "1") risks.push("PROXY_CONTRACT");
    if (security.is_mintable === "1") risks.push("MINTABLE");
    if (security.owner_change_balance === "1") risks.push("OWNER_CAN_CHANGE_BALANCE");
    if (security.hidden_owner === "1") risks.push("HIDDEN_OWNER");
    if (security.cannot_sell_all === "1") risks.push("CANNOT_SELL_ALL");

    const riskScore = risks.length === 0 ? "LOW" : risks.length <= 2 ? "MEDIUM" : "HIGH";

    return {
      token: topPair?.baseToken?.symbol || "UNKNOWN",
      name: topPair?.baseToken?.name || "Unknown Token",
      address,
      chain,
      price_usd: parseFloat(topPair?.priceUsd || "0"),
      market_cap: topPair?.marketCap || null,
      liquidity_usd: topPair?.liquidity?.usd || 0,
      volume_24h: topPair?.volume?.h24 || 0,
      holders: parseInt(security.holder_count || "0"),
      top10_holder_pct: parseFloat(security.top_10_holder_ratio || "0") * 100,
      security: {
        risk_score: riskScore,
        risks,
        is_honeypot: security.is_honeypot === "1",
        is_open_source: security.is_open_source === "1",
        is_mintable: security.is_mintable === "1",
        is_proxy: security.is_proxy === "1",
        owner: security.owner_address || null,
        buy_tax: parseFloat(security.buy_tax || "0") * 100,
        sell_tax: parseFloat(security.sell_tax || "0") * 100,
      },
      pairs_count: pairs.length,
      dex: topPair?.dexId || null,
      created_at: topPair?.pairCreatedAt || null,
      timestamp: new Date().toISOString(),
      source: "baseoracle:dexscreener+goplus",
    };
  }, 120); // 2 min cache
}
