import { Router } from "express";
import { fetchTokenPrice, fetchMultiplePrices } from "../data/prices.js";
import { fetchTrending } from "../data/trending.js";
import { fetchWhaleAlerts } from "../data/whales.js";
import { analyzeToken } from "../data/token-analysis.js";
import { fetchGasEstimate } from "../data/gas.js";
import { fetchPortfolio } from "../data/portfolio.js";
import { profileWallet } from "../data/wallet-profiler.js";
import { fetchOHLCV } from "../data/ohlcv.js";
import { verifyContract } from "../data/contract-verify.js";
import { findBestRoute } from "../data/dex-aggregator.js";
import { registerAgent, getAgent, listAgents } from "../data/agent-registry.js";
import { trackQuery, getMetrics } from "../utils/metrics.js";
import { getCacheStats } from "../utils/cache.js";
import { config } from "../config.js";

const router = Router();

// ============================================
// FREE ENDPOINTS (no x402 payment required)
// ============================================

/**
 * GET /api/v1/info
 * Service discovery for agents — tells them what endpoints exist and their prices
 */
router.get("/api/v1/info", (req, res) => {
  res.json({
    name: "BaseOracle",
    description:
      "Agent Data Oracle — pay-per-query data feeds for AI agents on Base",
    version: "1.0.0",
    chain: "Base (eip155:8453)",
    payment: "x402 (USDC on Base)",
    token: "$ORACLE",
    endpoints: [
      {
        path: "/api/v1/game-config",
        method: "GET",
        price_usdc: 0,
        description: "Public config for Web3 game frontend (chain + contract)",
      },
      {
        path: "/api/v1/prices",
        method: "GET",
        price_usdc: 0.001,
        params: "?token=SYMBOL_OR_ADDRESS",
        description: "Real-time token price, volume, liquidity, change %",
      },
      {
        path: "/api/v1/prices/batch",
        method: "GET",
        price_usdc: 0.001,
        params: "?tokens=MOLT,CLANKER,CLAWNCH",
        description: "Multiple token prices in one call",
      },
      {
        path: "/api/v1/trending",
        method: "GET",
        price_usdc: 0.002,
        description: "Top trending tokens on Base by volume and momentum",
      },
      {
        path: "/api/v1/whale-alerts",
        method: "GET",
        price_usdc: 0.005,
        description: "Large transfers (>$50k) on Base in real-time",
      },
      {
        path: "/api/v1/token-analysis",
        method: "GET",
        price_usdc: 0.005,
        params: "?address=0x...&chain=base|bsc|ethereum",
        description: "Full token analysis: price, security audit, rug check, holder data",
      },
      {
        path: "/api/v1/gas",
        method: "GET",
        price_usdc: 0.001,
        params: "?chain=base|bsc|ethereum",
        description: "Gas price + cost estimates for common operations",
      },
      {
        path: "/api/v1/portfolio",
        method: "GET",
        price_usdc: 0.003,
        params: "?address=0x...&chain=base|bsc",
        description: "All token balances + USD value for a wallet",
      },
      {
        path: "/api/v1/wallet-profile",
        method: "GET",
        price_usdc: 0.005,
        params: "?address=0x...&chain=base|bsc",
        description: "Wallet trading history, activity type, top tokens traded",
      },
      {
        path: "/api/v1/ohlcv",
        method: "GET",
        price_usdc: 0.003,
        params: "?address=0x...&chain=base&interval=1h&limit=100",
        description: "Historical OHLCV candles for any token",
      },
      {
        path: "/api/v1/contract-verify",
        method: "GET",
        price_usdc: 0.01,
        params: "?address=0x...&chain=base|bsc",
        description: "Smart contract safety verification: honeypot, rug, tax checks",
      },
      {
        path: "/api/v1/route",
        method: "GET",
        price_usdc: 0.005,
        params: "?tokenIn=ETH&tokenOut=USDC&amount=1&chain=base",
        description: "Best swap route across all DEXs on a chain",
      },
      {
        path: "/api/v1/agents",
        method: "GET",
        price_usdc: 0,
        description: "Agent registry: list verified on-chain agents (FREE)",
      },
      {
        path: "/api/v1/agents/register",
        method: "POST",
        price_usdc: 0,
        description: "Register your agent in the directory (FREE)",
      },
    ],
    links: {
      docs: "https://github.com/baseoracle/baseoracle",
      token: "https://www.clanker.world/clanker/TOKEN_ADDRESS",
      x: "https://x.com/BaseOracleXYZ",
    },
  });
});

/**
 * GET /api/v1/health
 * Health check for monitoring
 */
router.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/metrics
 * Public metrics dashboard (queries count, revenue, uptime)
 */
router.get("/api/v1/metrics", (req, res) => {
  res.json({
    ...getMetrics(),
    cache: getCacheStats(),
  });
});


router.get("/api/v1/game-config", (req, res) => {
  res.json({
    chainId: config.game.chainId,
    chainName: config.game.chainName,
    contractAddress: config.game.contractAddress,
    rpcUrl: config.game.rpcUrl,
    blockExplorerUrl: config.game.blockExplorerUrl,
  });
});

// ============================================
// PAID ENDPOINTS (x402 payment required)
// ============================================

/**
 * GET /api/v1/prices?token=MOLT
 * Price: $0.001 USDC
 */
router.get("/api/v1/prices", async (req, res) => {
  try {
    trackQuery("/api/v1/prices");

    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        error: "Missing 'token' query parameter",
        example: "/api/v1/prices?token=MOLT",
      });
    }

    const data = await fetchTokenPrice(token);
    res.json(data);
  } catch (err) {
    console.error("Error in /prices:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/prices/batch?tokens=MOLT,CLANKER,CLAWNCH
 * Price: $0.001 USDC (same as single, but more value)
 */
router.get("/api/v1/prices/batch", async (req, res) => {
  try {
    trackQuery("/api/v1/prices");

    const { tokens } = req.query;
    if (!tokens) {
      return res.status(400).json({
        error: "Missing 'tokens' query parameter",
        example: "/api/v1/prices/batch?tokens=MOLT,CLANKER,CLAWNCH",
      });
    }

    const tokenList = tokens
      .split(",")
      .map((t) => t.trim())
      .slice(0, 10); // Max 10 per batch

    const data = await fetchMultiplePrices(tokenList);
    res.json({
      results: data,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error in /prices/batch:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/trending
 * Price: $0.002 USDC
 */
router.get("/api/v1/trending", async (req, res) => {
  try {
    trackQuery("/api/v1/trending");
    const data = await fetchTrending();
    res.json(data);
  } catch (err) {
    console.error("Error in /trending:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/whale-alerts
 * Price: $0.005 USDC
 */
router.get("/api/v1/whale-alerts", async (req, res) => {
  try {
    trackQuery("/api/v1/whale-alerts");
    const data = await fetchWhaleAlerts();
    res.json(data);
  } catch (err) {
    console.error("Error in /whale-alerts:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================
// NEW ENDPOINTS v1.1
// ============================================

/** GET /api/v1/token-analysis?address=0x...&chain=base — $0.005 */
router.get("/api/v1/token-analysis", async (req, res) => {
  try {
    trackQuery("/api/v1/token-analysis");
    const { address, chain } = req.query;
    if (!address) return res.status(400).json({ error: "Missing 'address' param", example: "/api/v1/token-analysis?address=0x..." });
    res.json(await analyzeToken(address, chain || "base"));
  } catch (err) { console.error("Error in /token-analysis:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

/** GET /api/v1/gas?chain=base — $0.001 */
router.get("/api/v1/gas", async (req, res) => {
  try {
    trackQuery("/api/v1/gas");
    res.json(await fetchGasEstimate(req.query.chain || "base"));
  } catch (err) { console.error("Error in /gas:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

/** GET /api/v1/portfolio?address=0x...&chain=base — $0.003 */
router.get("/api/v1/portfolio", async (req, res) => {
  try {
    trackQuery("/api/v1/portfolio");
    const { address, chain } = req.query;
    if (!address) return res.status(400).json({ error: "Missing 'address' param" });
    res.json(await fetchPortfolio(address, chain || "base"));
  } catch (err) { console.error("Error in /portfolio:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

/** GET /api/v1/wallet-profile?address=0x...&chain=base — $0.005 */
router.get("/api/v1/wallet-profile", async (req, res) => {
  try {
    trackQuery("/api/v1/wallet-profile");
    const { address, chain } = req.query;
    if (!address) return res.status(400).json({ error: "Missing 'address' param" });
    res.json(await profileWallet(address, chain || "base"));
  } catch (err) { console.error("Error in /wallet-profile:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

/** GET /api/v1/ohlcv?address=0x...&interval=1h&limit=100 — $0.003 */
router.get("/api/v1/ohlcv", async (req, res) => {
  try {
    trackQuery("/api/v1/ohlcv");
    const { address, chain, interval, limit } = req.query;
    if (!address) return res.status(400).json({ error: "Missing 'address' param" });
    res.json(await fetchOHLCV(address, chain || "base", interval || "1h", parseInt(limit || "100")));
  } catch (err) { console.error("Error in /ohlcv:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

/** GET /api/v1/contract-verify?address=0x...&chain=base — $0.01 */
router.get("/api/v1/contract-verify", async (req, res) => {
  try {
    trackQuery("/api/v1/contract-verify");
    const { address, chain } = req.query;
    if (!address) return res.status(400).json({ error: "Missing 'address' param" });
    res.json(await verifyContract(address, chain || "base"));
  } catch (err) { console.error("Error in /contract-verify:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

/** GET /api/v1/route?tokenIn=ETH&tokenOut=USDC&chain=base — $0.005 */
router.get("/api/v1/route", async (req, res) => {
  try {
    trackQuery("/api/v1/route");
    const { tokenIn, tokenOut, amount, chain } = req.query;
    if (!tokenIn || !tokenOut) return res.status(400).json({ error: "Missing 'tokenIn' and 'tokenOut' params" });
    res.json(await findBestRoute(tokenIn, tokenOut, amount, chain || "base"));
  } catch (err) { console.error("Error in /route:", err.message); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================
// FREE ENDPOINTS — Agent Registry
// ============================================

/** GET /api/v1/agents?chain=base&capability=swap */
router.get("/api/v1/agents", (req, res) => {
  trackQuery("/api/v1/agents");
  res.json(listAgents(req.query.chain, req.query.capability));
});

/** GET /api/v1/agents/:address */
router.get("/api/v1/agents/:address", (req, res) => {
  trackQuery("/api/v1/agents");
  res.json(getAgent(req.params.address));
});

/** POST /api/v1/agents/register */
router.post("/api/v1/agents/register", (req, res) => {
  trackQuery("/api/v1/agents/register");
  res.json(registerAgent(req.body));
});

export default router;
