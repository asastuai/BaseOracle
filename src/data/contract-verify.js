import { cachedFetch } from "../utils/cache.js";

const GOPLUSLABS = "https://api.gopluslabs.io/api/v1";

/**
 * Contract safety verifier: checks if a contract is safe to interact with
 * Combines GoPlus security data + basic heuristics
 */
export async function verifyContract(address, chain = "base") {
  if (!address || !address.startsWith("0x")) {
    return { error: "Valid contract address required (0x...)" };
  }

  const chainMap = { base: "8453", bsc: "56", ethereum: "1" };
  const chainId = chainMap[chain];
  if (!chainId) return { error: `Unsupported chain: ${chain}` };

  const cacheKey = `verify:${chain}:${address.toLowerCase()}`;

  return cachedFetch(cacheKey, async () => {
    // GoPlus token security + contract security
    const [tokenRes, contractRes] = await Promise.allSettled([
      fetch(`${GOPLUSLABS}/token_security/${chainId}?contract_addresses=${address}`).then(r => r.json()),
      fetch(`${GOPLUSLABS}/address_security/${address}?chain_id=${chainId}`).then(r => r.json()),
    ]);

    const token = tokenRes.status === "fulfilled" ? tokenRes.value?.result?.[address.toLowerCase()] || {} : {};
    const contract = contractRes.status === "fulfilled" ? contractRes.value?.result || {} : {};

    const flags = [];
    const safe = [];

    // Token checks
    if (token.is_honeypot === "1") flags.push("HONEYPOT");
    else if (token.is_honeypot === "0") safe.push("NOT_HONEYPOT");

    if (token.is_open_source === "0") flags.push("CLOSED_SOURCE");
    else if (token.is_open_source === "1") safe.push("OPEN_SOURCE");

    if (token.is_mintable === "1") flags.push("MINTABLE");
    if (token.can_take_back_ownership === "1") flags.push("OWNERSHIP_TAKEBACK");
    if (token.owner_change_balance === "1") flags.push("OWNER_CAN_MODIFY_BALANCE");
    if (token.hidden_owner === "1") flags.push("HIDDEN_OWNER");
    if (token.cannot_sell_all === "1") flags.push("SELL_RESTRICTION");
    if (token.is_proxy === "1") flags.push("PROXY_CONTRACT");
    if (token.external_call === "1") flags.push("EXTERNAL_CALLS");
    if (token.selfdestruct === "1") flags.push("SELF_DESTRUCT");

    if (token.is_anti_whale === "1") safe.push("ANTI_WHALE");
    if (token.is_blacklisted === "0") safe.push("NO_BLACKLIST");

    // Buy/sell tax
    const buyTax = parseFloat(token.buy_tax || "0") * 100;
    const sellTax = parseFloat(token.sell_tax || "0") * 100;
    if (buyTax > 10) flags.push(`HIGH_BUY_TAX_${buyTax.toFixed(0)}%`);
    if (sellTax > 10) flags.push(`HIGH_SELL_TAX_${sellTax.toFixed(0)}%`);

    // Contract address checks
    if (contract.cybercrime === "1") flags.push("FLAGGED_CYBERCRIME");
    if (contract.money_laundering === "1") flags.push("MONEY_LAUNDERING");
    if (contract.phishing_activities === "1") flags.push("PHISHING");

    // Score
    let score = 100;
    score -= flags.length * 15;
    score += safe.length * 5;
    score = Math.max(0, Math.min(100, score));

    const verdict = score >= 80 ? "SAFE" : score >= 50 ? "CAUTION" : "DANGEROUS";

    return {
      address,
      chain,
      verdict,
      score,
      flags,
      safe_indicators: safe,
      details: {
        is_honeypot: token.is_honeypot === "1",
        is_open_source: token.is_open_source === "1",
        is_proxy: token.is_proxy === "1",
        is_mintable: token.is_mintable === "1",
        buy_tax_pct: buyTax,
        sell_tax_pct: sellTax,
        owner: token.owner_address || null,
        creator: token.creator_address || null,
        holder_count: parseInt(token.holder_count || "0"),
        lp_holder_count: parseInt(token.lp_holder_count || "0"),
      },
      timestamp: new Date().toISOString(),
      source: "baseoracle:goplus",
    };
  }, 300); // 5 min cache
}
