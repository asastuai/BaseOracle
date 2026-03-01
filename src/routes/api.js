import { Router } from "express";
import { fetchTokenPrice, fetchMultiplePrices } from "../data/prices.js";
import { fetchTrending } from "../data/trending.js";
import { fetchWhaleAlerts } from "../data/whales.js";
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

export default router;
