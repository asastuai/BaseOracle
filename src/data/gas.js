import { cachedFetch } from "../utils/cache.js";

const RPC_URLS = {
  base: "https://mainnet.base.org",
  bsc: "https://bsc-dataseed.binance.org",
  ethereum: "https://eth.llamarpc.com",
};

/**
 * Gas price estimator for multiple chains
 */
export async function fetchGasEstimate(chain = "base") {
  const rpc = RPC_URLS[chain];
  if (!rpc) return { error: `Unsupported chain: ${chain}. Supported: ${Object.keys(RPC_URLS).join(", ")}` };

  const cacheKey = `gas:${chain}`;

  return cachedFetch(cacheKey, async () => {
    const [gasPriceRes, blockRes] = await Promise.allSettled([
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
      }).then(r => r.json()),
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
      }).then(r => r.json()),
    ]);

    const gasPriceWei = gasPriceRes.status === "fulfilled" ? parseInt(gasPriceRes.value.result, 16) : 0;
    const blockNumber = blockRes.status === "fulfilled" ? parseInt(blockRes.value.result, 16) : 0;
    const gasPriceGwei = gasPriceWei / 1e9;

    // Estimate costs for common operations
    const estimates = {
      transfer: { gas: 21000, cost_usd: null },
      erc20_transfer: { gas: 65000, cost_usd: null },
      swap: { gas: 150000, cost_usd: null },
      add_liquidity: { gas: 250000, cost_usd: null },
      contract_deploy: { gas: 2000000, cost_usd: null },
    };

    // Get native token price for USD estimates
    const nativeToken = chain === "bsc" ? "BNB" : chain === "ethereum" ? "ETH" : "ETH";
    try {
      const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${nativeToken}%20USDC`);
      const priceData = await priceRes.json();
      const nativePrice = parseFloat(priceData.pairs?.[0]?.priceUsd || "0");

      if (nativePrice > 0) {
        for (const [key, est] of Object.entries(estimates)) {
          est.cost_usd = parseFloat(((est.gas * gasPriceWei / 1e18) * nativePrice).toFixed(6));
        }
      }
    } catch {}

    return {
      chain,
      block_number: blockNumber,
      gas_price_gwei: parseFloat(gasPriceGwei.toFixed(4)),
      gas_price_wei: gasPriceWei,
      estimates,
      recommendation: gasPriceGwei < 0.01 ? "VERY_CHEAP" : gasPriceGwei < 1 ? "CHEAP" : gasPriceGwei < 20 ? "NORMAL" : "EXPENSIVE",
      timestamp: new Date().toISOString(),
      source: "baseoracle:rpc",
    };
  }, 10); // 10s cache
}
