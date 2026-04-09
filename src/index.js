import express from "express";
import cors from "cors";
import helmet from "helmet";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { config } from "./config.js";
import apiRoutes from "./routes/api.js";
import { LocalFacilitator } from "./local-facilitator.js";

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(express.static("public"));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ============================================
// x402 PAYMENT MIDDLEWARE — LocalFacilitator
// Self-hosted, no external dependency
// ============================================
const localFacilitator = new LocalFacilitator();

const resourceServer = new x402ResourceServer(localFacilitator)
  .register(config.network, new ExactEvmScheme())
  .register("eip155:84532", new ExactEvmScheme()); // Base Sepolia para tests

const paymentConfig = {
  "GET /api/v1/prices": {
    accepts: [{
      scheme: "exact",
      price: config.pricing.prices,
      network: config.network,
      payTo: config.payToAddress,
      asset: config.usdcAddress,
    }],
    description: "Real-time token price data on Base",
  },
  "GET /api/v1/prices/batch": {
    accepts: [{
      scheme: "exact",
      price: config.pricing.prices,
      network: config.network,
      payTo: config.payToAddress,
      asset: config.usdcAddress,
    }],
    description: "Batch token prices on Base",
  },
  "GET /api/v1/trending": {
    accepts: [{
      scheme: "exact",
      price: config.pricing.trending,
      network: config.network,
      payTo: config.payToAddress,
      asset: config.usdcAddress,
    }],
    description: "Trending tokens on Base (Clanker + Clawnch)",
  },
  "GET /api/v1/whale-alerts": {
    accepts: [{
      scheme: "exact",
      price: config.pricing.whaleAlerts,
      network: config.network,
      payTo: config.payToAddress,
      asset: config.usdcAddress,
    }],
    description: "Large on-chain movements (>$50k) on Base",
  },
  "GET /api/v1/token-analysis": {
    accepts: [{ scheme: "exact", price: config.pricing.tokenAnalysis, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "Full token security audit + price + holder analysis",
  },
  "GET /api/v1/gas": {
    accepts: [{ scheme: "exact", price: config.pricing.gas, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "Gas price + cost estimates for common operations",
  },
  "GET /api/v1/portfolio": {
    accepts: [{ scheme: "exact", price: config.pricing.portfolio, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "Wallet portfolio: all token balances + USD values",
  },
  "GET /api/v1/wallet-profile": {
    accepts: [{ scheme: "exact", price: config.pricing.walletProfile, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "Wallet profiler: trading history, activity type, top tokens",
  },
  "GET /api/v1/ohlcv": {
    accepts: [{ scheme: "exact", price: config.pricing.ohlcv, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "Historical OHLCV candle data for any token",
  },
  "GET /api/v1/contract-verify": {
    accepts: [{ scheme: "exact", price: config.pricing.contractVerify, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "Smart contract safety verification: honeypot, rug, tax detection",
  },
  "GET /api/v1/route": {
    accepts: [{ scheme: "exact", price: config.pricing.route, network: config.network, payTo: config.payToAddress, asset: config.usdcAddress }],
    description: "DEX aggregator: best swap route across all DEXs",
  },
};

app.use(paymentMiddleware(paymentConfig, resourceServer));

// ============================================
// ROUTES
// ============================================
app.use(apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", hint: "Try GET /api/v1/info or open /game" });
});

app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ============================================
// START
// ============================================
app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          🔮 BASEORACLE v2.0.0               ║
║    Agent Infrastructure Platform            ║
╠══════════════════════════════════════════════╣
║  Server:    http://localhost:${config.port}            ║
║  Network:   Base Mainnet (8453)              ║
║  Payment:   x402 (USDC)                     ║
║  Wallet:    ${config.payToAddress?.slice(0,10)}...      ║
╠══════════════════════════════════════════════╣
║  15 ENDPOINTS:                               ║
║  Free:  /info /health /metrics /agents       ║
║  $0.001: /prices /gas                        ║
║  $0.002: /trending                           ║
║  $0.003: /portfolio /ohlcv                   ║
║  $0.005: /whale-alerts /token-analysis       ║
║          /wallet-profile /route              ║
║  $0.010: /contract-verify                    ║
╚══════════════════════════════════════════════╝
  `);
});
