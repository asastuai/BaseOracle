import { cachedFetch } from "../utils/cache.js";
import { config } from "../config.js";

const BASESCAN_API = "https://api.basescan.org/api";

// Known addresses for context
const KNOWN_ADDRESSES = {
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "uniswap_universal_router",
  "0x198ef79f1f515f02dfe9e3115ed9fc07183f02fc": "clanker_deployer",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "usdc_contract",
  "0x4200000000000000000000000000000000000006": "weth_contract",
};

/**
 * Fetch large token transfers on Base (whale movements)
 */
export async function fetchWhaleAlerts() {
  return cachedFetch(
    "whales:base",
    async () => {
      const alerts = [];

      // Fetch large ETH transfers
      const ethAlerts = await fetchLargeEthTransfers();
      alerts.push(...ethAlerts);

      // Fetch large USDC transfers
      const usdcAlerts = await fetchLargeTokenTransfers(
        config.usdcAddress,
        "USDC",
        6,
        50000 // min $50k
      );
      alerts.push(...usdcAlerts);

      // Fetch large WETH transfers
      const wethAlerts = await fetchLargeTokenTransfers(
        "0x4200000000000000000000000000000000000006",
        "WETH",
        18,
        20 // min 20 ETH (~$50k at ~$2500/ETH)
      );
      alerts.push(...wethAlerts);

      // Sort by timestamp (most recent first)
      alerts.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      return {
        alerts: alerts.slice(0, 50),
        total_alerts: alerts.length,
        min_threshold_usd: 50000,
        timestamp: new Date().toISOString(),
        source: "baseoracle:basescan",
      };
    },
    config.cacheTtl.whales
  );
}

/**
 * Fetch large native ETH transfers
 */
async function fetchLargeEthTransfers() {
  try {
    if (!config.basescanApiKey) return [];

    // Get latest blocks
    const blockResp = await fetch(
      `${BASESCAN_API}?module=proxy&action=eth_blockNumber&apikey=${config.basescanApiKey}`
    );
    const blockData = await blockResp.json();
    const latestBlock = parseInt(blockData.result, 16);
    const fromBlock = latestBlock - 100; // ~last 200 seconds

    const resp = await fetch(
      `${BASESCAN_API}?module=account&action=txlistinternal` +
        `&startblock=${fromBlock}&endblock=${latestBlock}` +
        `&page=1&offset=100&sort=desc` +
        `&apikey=${config.basescanApiKey}`
    );

    const data = await resp.json();
    if (data.status !== "1" || !data.result) return [];

    // Filter for large transfers (>20 ETH)
    const minWei = BigInt("20000000000000000000"); // 20 ETH

    return data.result
      .filter((tx) => BigInt(tx.value) >= minWei)
      .slice(0, 20)
      .map((tx) => ({
        type: "large_eth_transfer",
        token: "ETH",
        amount: parseFloat(
          (Number(BigInt(tx.value)) / 1e18).toFixed(4)
        ),
        amount_usd: null, // Would need ETH price to calc
        from: tx.from,
        from_label: KNOWN_ADDRESSES[tx.from?.toLowerCase()] || null,
        to: tx.to,
        to_label: KNOWN_ADDRESSES[tx.to?.toLowerCase()] || null,
        tx_hash: tx.hash,
        block: parseInt(tx.blockNumber),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch large ERC-20 token transfers
 */
async function fetchLargeTokenTransfers(
  contractAddress,
  symbol,
  decimals,
  minAmount
) {
  try {
    if (!config.basescanApiKey) return [];

    const resp = await fetch(
      `${BASESCAN_API}?module=account&action=tokentx` +
        `&contractaddress=${contractAddress}` +
        `&page=1&offset=100&sort=desc` +
        `&apikey=${config.basescanApiKey}`
    );

    const data = await resp.json();
    if (data.status !== "1" || !data.result) return [];

    const minRaw = BigInt(minAmount) * BigInt(10 ** decimals);

    return data.result
      .filter((tx) => BigInt(tx.value) >= minRaw)
      .slice(0, 20)
      .map((tx) => {
        const amount =
          Number(BigInt(tx.value)) / Math.pow(10, decimals);
        return {
          type: `large_${symbol.toLowerCase()}_transfer`,
          token: symbol,
          amount: parseFloat(amount.toFixed(decimals <= 6 ? 2 : 4)),
          amount_usd: symbol === "USDC" ? parseFloat(amount.toFixed(2)) : null,
          from: tx.from,
          from_label: KNOWN_ADDRESSES[tx.from?.toLowerCase()] || null,
          to: tx.to,
          to_label: KNOWN_ADDRESSES[tx.to?.toLowerCase()] || null,
          tx_hash: tx.hash,
          block: parseInt(tx.blockNumber),
          timestamp: new Date(
            parseInt(tx.timeStamp) * 1000
          ).toISOString(),
        };
      });
  } catch {
    return [];
  }
}
