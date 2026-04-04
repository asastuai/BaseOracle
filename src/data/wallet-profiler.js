import { cachedFetch } from "../utils/cache.js";

/**
 * Wallet profiler: trading history, PnL, win rate
 * Uses DexScreener's wallet endpoint
 */
export async function profileWallet(address, chain = "base") {
  if (!address || !address.startsWith("0x")) {
    return { error: "Valid wallet address required (0x...)" };
  }

  const cacheKey = `profile:${chain}:${address.toLowerCase()}`;

  return cachedFetch(cacheKey, async () => {
    // Fetch recent transactions from block explorer APIs
    const explorerApis = {
      base: "https://api.basescan.org/api",
      bsc: "https://api.bscscan.com/api",
      ethereum: "https://api.etherscan.io/api",
    };

    const apiUrl = explorerApis[chain];
    if (!apiUrl) return { error: `Unsupported chain: ${chain}` };

    // Fetch normal transactions + token transfers in parallel
    const [txRes, tokenRes] = await Promise.allSettled([
      fetch(`${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc`).then(r => r.json()),
      fetch(`${apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc`).then(r => r.json()),
    ]);

    const txs = txRes.status === "fulfilled" && txRes.value.result ? (Array.isArray(txRes.value.result) ? txRes.value.result : []) : [];
    const tokenTxs = tokenRes.status === "fulfilled" && tokenRes.value.result ? (Array.isArray(tokenRes.value.result) ? tokenRes.value.result : []) : [];

    // Analyze activity
    const now = Date.now() / 1000;
    const last30d = txs.filter(tx => now - parseInt(tx.timeStamp) < 30 * 86400);
    const last7d = txs.filter(tx => now - parseInt(tx.timeStamp) < 7 * 86400);

    // Token activity analysis
    const tokenActivity = {};
    for (const tx of tokenTxs) {
      const sym = tx.tokenSymbol || "UNKNOWN";
      if (!tokenActivity[sym]) tokenActivity[sym] = { buys: 0, sells: 0, symbol: sym };
      if (tx.to.toLowerCase() === address.toLowerCase()) tokenActivity[sym].buys++;
      else tokenActivity[sym].sells++;
    }

    const topTokens = Object.values(tokenActivity)
      .sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells))
      .slice(0, 10);

    // Determine wallet type
    const txFrequency = last7d.length / 7;
    let walletType = "INACTIVE";
    if (txFrequency > 50) walletType = "BOT";
    else if (txFrequency > 10) walletType = "ACTIVE_TRADER";
    else if (txFrequency > 1) walletType = "REGULAR";
    else if (txs.length > 0) walletType = "HODLER";

    const firstTx = txs.length > 0 ? txs[txs.length - 1] : null;
    const ageDays = firstTx ? Math.floor((now - parseInt(firstTx.timeStamp)) / 86400) : 0;

    return {
      wallet: address,
      chain,
      wallet_type: walletType,
      age_days: ageDays,
      total_transactions: txs.length,
      transactions_30d: last30d.length,
      transactions_7d: last7d.length,
      avg_daily_txs: parseFloat(txFrequency.toFixed(1)),
      unique_tokens_traded: Object.keys(tokenActivity).length,
      top_tokens: topTokens,
      first_transaction: firstTx ? new Date(parseInt(firstTx.timeStamp) * 1000).toISOString() : null,
      last_transaction: txs[0] ? new Date(parseInt(txs[0].timeStamp) * 1000).toISOString() : null,
      timestamp: new Date().toISOString(),
      source: "baseoracle:explorer",
    };
  }, 120);
}
