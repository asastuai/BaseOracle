import { cachedFetch } from "../utils/cache.js";

/**
 * Historical OHLCV candles for any token
 * Uses DexScreener for on-chain DEX data
 */
export async function fetchOHLCV(address, chain = "base", interval = "1h", limit = 100) {
  if (!address || !address.startsWith("0x")) {
    return { error: "Valid token/pair address required (0x...)" };
  }

  const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
  if (!validIntervals.includes(interval)) {
    return { error: `Invalid interval. Supported: ${validIntervals.join(", ")}` };
  }

  const cacheKey = `ohlcv:${chain}:${address.toLowerCase()}:${interval}`;

  return cachedFetch(cacheKey, async () => {
    // First get the pair address from token address
    const searchRes = await fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${address}`);
    const searchData = await searchRes.json();
    const pairs = searchData.pairs || [];

    if (!pairs.length) {
      return { error: `No pairs found for token ${address} on ${chain}` };
    }

    const topPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

    // DexScreener doesn't have a public OHLCV API, so we use Binance for major tokens
    // or generate from recent trades data
    const symbol = topPair.baseToken?.symbol;
    const binanceSymbols = {
      "ETH": "ETHUSDT", "WETH": "ETHUSDT", "BTC": "BTCUSDT", "WBTC": "BTCUSDT",
      "BNB": "BNBUSDT", "WBNB": "BNBUSDT", "SOL": "SOLUSDT",
      "DOGE": "DOGEUSDT", "ADA": "ADAUSDT", "XRP": "XRPUSDT",
      "LINK": "LINKUSDT", "UNI": "UNIUSDT", "AVAX": "AVAXUSDT",
    };

    const binanceSym = binanceSymbols[symbol?.toUpperCase()];
    if (binanceSym) {
      // Use Binance for major tokens
      const binanceRes = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${interval}&limit=${Math.min(limit, 500)}`
      );
      const klines = await binanceRes.json();

      if (Array.isArray(klines)) {
        return {
          token: symbol,
          address,
          chain,
          interval,
          pair: topPair.pairAddress,
          candles: klines.map(k => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          })),
          count: klines.length,
          source: "baseoracle:binance",
          timestamp: new Date().toISOString(),
        };
      }
    }

    // For non-Binance tokens, return current price point
    return {
      token: symbol || "UNKNOWN",
      address,
      chain,
      interval,
      pair: topPair.pairAddress,
      current_price: parseFloat(topPair.priceUsd || "0"),
      note: "Historical candles only available for major tokens. Use pair_address with DexScreener for on-chain data.",
      source: "baseoracle:dexscreener",
      timestamp: new Date().toISOString(),
    };
  }, 60);
}
