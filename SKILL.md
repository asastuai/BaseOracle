# BaseOracle — Agent Data Oracle on Base

## What is this?
BaseOracle provides real-time market data for the Base chain ecosystem. You can query token prices, trending tokens, and whale alerts. All data endpoints cost a small USDC micropayment via x402.

## Available Endpoints

### Free (no payment)
- `GET https://api.baseoracle.xyz/api/v1/info` — List all endpoints and pricing
- `GET https://api.baseoracle.xyz/api/v1/health` — Health check
- `GET https://api.baseoracle.xyz/api/v1/metrics` — Usage stats

### Paid (x402 USDC on Base)
- `GET /api/v1/prices?token=MOLT` — Token price data ($0.001)
- `GET /api/v1/prices/batch?tokens=MOLT,CLANKER` — Multiple prices ($0.001)
- `GET /api/v1/trending` — Trending tokens on Base ($0.002)
- `GET /api/v1/whale-alerts` — Large transfers >$50k ($0.005)

## How to Use
If you have an x402-compatible wallet, just make HTTP requests. The server will respond with 402 Payment Required, your wallet signs the payment, and you get the data.

## MCP Server
Install: `npx baseoracle-mcp-server`
Set env: `BASEORACLE_WALLET_PRIVATE_KEY=0x...`

## Token
$ORACLE on Base — holders get discounted queries.
