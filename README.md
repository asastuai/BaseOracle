<div align="center">

# 🔮 BaseOracle

### Pay-per-query market data for autonomous AI agents on Base

[![Base L2](https://img.shields.io/badge/Base-L2-0052FF.svg)](https://base.org)
[![x402](https://img.shields.io/badge/payments-x402-brightgreen.svg)](https://www.x402.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Related](https://img.shields.io/badge/PayClaw-agent%20wallet%20SDK-blueviolet.svg)](https://github.com/asastuai/payclaw)

The Bloomberg Terminal for autonomous AI agents — real-time prices, trending tokens, whale alerts. Agents pay per query in USDC via the x402 micropayment protocol, no accounts, no subscriptions.

</div>

---

## What it is

BaseOracle is market data infrastructure **designed for machine consumers**, not humans. AI agents that need pricing, trend, or whale-movement data make HTTP requests just like they would against any REST API — except every monetized endpoint expects a x402-formatted USDC payment in the request itself. No API key to manage. No subscription to renew. The agent pays, the data is returned, the USDC lands in the operator's wallet.

Part of a small stack of agent-native primitives:

- [**BaseOracle**](https://github.com/asastuai/BaseOracle) — *(this repo)* — data layer for agents
- [**PayClaw**](https://github.com/asastuai/payclaw) — agent wallet SDK with programmable rules
- [**TrustLayer**](https://github.com/asastuai/TrustLayer) — reputation scoring for autonomous agents

---

## Quick start

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

---

## Architecture

```
AI Agents  →  HTTP GET + x402 payment  →  BaseOracle API  →  Data sources
                                                ↓
                                         USDC → operator wallet
```

Every monetized endpoint returns `402 Payment Required` on the first request, with a payment challenge in the response header. The agent signs a USDC transfer authorization, retries with the payment attached, and receives the data in the second response. See [x402.org](https://www.x402.org/) for protocol details.

---

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

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Payments | x402 protocol (Coinbase CDP facilitator) |
| Data sources | DexScreener API, BaseScan API |
| Token | Clanker v4 on Base (Uniswap V4) |
| Chain | Base (Coinbase L2) |

---

## Deploy

### To Railway

1. Push code to GitHub
2. Open [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add environment variables from `.env.example`
4. Railway auto-detects Node.js and runs `npm start`
5. Grab the public URL and update the MCP server + docs

### Token (`$ORACLE` on Clanker v4)

```bash
# 1. Upload logo to IPFS (use nft.storage)
# 2. Edit scripts/deploy-token.js with your IPFS CID
# 3. Run:
npm run deploy-token
```

---

## MCP server (for OpenClaw agents)

```bash
cd mcp-server
npm publish              # or: npx baseoracle-mcp-server
```

---

## Revenue model

- **x402 queries** — USDC goes directly to operator wallet per query
- **LP fees** — trading fees from `$ORACLE` on Clanker v4, claim at [clanker.world](https://clanker.world)
- **Buyback flywheel** — query revenue buys back `$ORACLE`, tightening the supply loop

---

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Juan Cruz Maisu](https://github.com/asastuai) · Buenos Aires, Argentina
