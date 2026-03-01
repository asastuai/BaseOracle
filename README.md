# ðŸ”® BaseOracle

**Agent Data Oracle â€” pay-per-query data feeds for AI agents on Base.**

BaseOracle is the Bloomberg Terminal for autonomous AI agents. It provides real-time market data (prices, trending tokens, whale alerts) that agents pay for automatically via x402 micropayments in USDC.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/asastuai/BaseOracle.git
cd baseoracle

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your wallet address and API keys

# 4. Run
npm start
```

## Architecture

```
AI Agents â†’ HTTP GET + x402 payment â†’ BaseOracle API â†’ Data Sources
                                          â†“
                                    USDC â†’ Your Wallet
```

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/v1/info` | Free | Service discovery |
| `GET /api/v1/health` | Free | Health check |
| `GET /api/v1/metrics` | Free | Usage dashboard |
| `GET /api/v1/prices?token=X` | $0.001 | Token price data |
| `GET /api/v1/prices/batch?tokens=X,Y` | $0.001 | Batch prices |
| `GET /api/v1/trending` | $0.002 | Trending tokens |
| `GET /api/v1/whale-alerts` | $0.005 | Whale movements |

## Deploy Token

```bash
# 1. Upload logo to IPFS (use nft.storage)
# 2. Edit scripts/deploy-token.js with your IPFS CID
# 3. Run:
npm run deploy-token
```

## Deploy to Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project â†’ Deploy from GitHub repo
4. Add environment variables from .env.example
5. Railway auto-detects Node.js and runs `npm start`
6. Get your public URL â†’ update MCP server and docs

## MCP Server (for OpenClaw agents)

```bash
cd mcp-server
npm publish  # or npx baseoracle-mcp-server
```

## Revenue Model

- **x402 queries**: USDC goes directly to your wallet per query
- **LP fees**: Trading fees from $ORACLE on Clanker v4, claim at clanker.world
- **Buyback**: Use query revenue to buy back $ORACLE, creating flywheel

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Payments**: x402 protocol (Coinbase CDP facilitator)
- **Data**: DexScreener API, Basescan API
- **Token**: Clanker v4 on Base (Uniswap V4)
- **Chain**: Base (Coinbase L2)

## License

MIT
