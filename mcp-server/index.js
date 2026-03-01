#!/usr/bin/env node

/**
 * BaseOracle MCP Server
 *
 * Provides AI agents with tools to query real-time market data on Base chain.
 * Payments are handled automatically via x402 (USDC on Base).
 *
 * Usage by agents:
 *   npx baseoracle-mcp-server
 *
 * Required env vars in the agent's config:
 *   BASEORACLE_WALLET_PRIVATE_KEY - Agent's wallet private key (for x402 payments)
 *
 * Or set BASEORACLE_API_URL to point to a custom BaseOracle server.
 */

const API_URL = process.env.BASEORACLE_API_URL || "https://api.baseoracle.xyz";

// Tool definitions for MCP protocol
const tools = [
  {
    name: "baseoracle_get_price",
    description:
      "Get real-time price data for any token on Base chain. Returns price, market cap, volume, liquidity, and price changes. Costs $0.001 USDC via x402.",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description:
            "Token symbol (e.g. 'MOLT', 'CLANKER') or contract address (0x...)",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "baseoracle_get_batch_prices",
    description:
      "Get prices for multiple tokens at once (max 10). Costs $0.001 USDC via x402.",
    inputSchema: {
      type: "object",
      properties: {
        tokens: {
          type: "string",
          description:
            "Comma-separated token symbols or addresses (e.g. 'MOLT,CLANKER,CLAWNCH')",
        },
      },
      required: ["tokens"],
    },
  },
  {
    name: "baseoracle_get_trending",
    description:
      "Get trending tokens on Base chain sorted by volume and momentum. Shows top 25 tokens with price, volume, and change data. Costs $0.002 USDC via x402.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "baseoracle_get_whale_alerts",
    description:
      "Get large transfers (>$50k) happening on Base chain in real-time. Tracks ETH, USDC, and WETH whale movements. Costs $0.005 USDC via x402.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "baseoracle_info",
    description:
      "Get information about BaseOracle service — available endpoints, pricing, and links. FREE, no payment required.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Execute a tool call
 */
async function executeTool(name, args) {
  try {
    let url;
    let needsPayment = true;

    switch (name) {
      case "baseoracle_get_price":
        url = `${API_URL}/api/v1/prices?token=${encodeURIComponent(args.token)}`;
        break;
      case "baseoracle_get_batch_prices":
        url = `${API_URL}/api/v1/prices/batch?tokens=${encodeURIComponent(args.tokens)}`;
        break;
      case "baseoracle_get_trending":
        url = `${API_URL}/api/v1/trending`;
        break;
      case "baseoracle_get_whale_alerts":
        url = `${API_URL}/api/v1/whale-alerts`;
        break;
      case "baseoracle_info":
        url = `${API_URL}/api/v1/info`;
        needsPayment = false;
        break;
      default:
        return { error: `Unknown tool: ${name}` };
    }

    // For paid endpoints, use x402-fetch which handles payment automatically
    // For free endpoints, use regular fetch
    let response;

    if (needsPayment) {
      // Dynamic import of x402 fetch wrapper
      const { wrapFetch } = await import("@x402/fetch");
      const { privateKeyToAccount } = await import("viem/accounts");

      const walletKey = process.env.BASEORACLE_WALLET_PRIVATE_KEY;
      if (!walletKey) {
        return {
          error:
            "BASEORACLE_WALLET_PRIVATE_KEY not set. Agent needs a funded wallet to pay for queries.",
        };
      }

      const account = privateKeyToAccount(walletKey);
      const x402Fetch = wrapFetch(fetch, account);
      response = await x402Fetch(url);
    } else {
      response = await fetch(url);
    }

    if (!response.ok) {
      return {
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

// ============================================
// MCP Protocol Handler (stdin/stdout JSON-RPC)
// ============================================

import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);

    if (request.method === "tools/list") {
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      const result = await executeTool(name, args || {});
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: err.message },
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});

// Signal ready
process.stderr.write("BaseOracle MCP Server ready\n");
