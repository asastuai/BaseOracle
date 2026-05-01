<div align="center">

# BaseOracle

### Pay-per-query market data for autonomous agents on Base. PoC `f_i` attestation on every paid response.

[![Base L2](https://img.shields.io/badge/Base-L2-0052FF.svg)](https://base.org)
[![x402](https://img.shields.io/badge/payments-x402-brightgreen.svg)](https://www.x402.org/)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-13%20passing-brightgreen.svg)](#tests)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Part of [**Aletheia**](https://github.com/asastuai/aletheia). Full stack for the agentic economics.*

</div>

---

## What it is

BaseOracle is market data infrastructure designed for machine consumers, not humans. AI agents that need pricing, trend, gas, portfolio, OHLCV, contract verification, DEX routing, or whale-movement data make HTTP requests like they would against any REST API. Every monetized endpoint expects an x402-formatted USDC payment in the request itself. No API key. No subscription. Agent pays, data is returned, USDC lands in the operator's wallet.

Every paid response carries a Proof-of-Context attestation typed as input freshness (`f_i`). A consumer that integrates the attestation can verify the operator's Ed25519 signature over the response and refuse to settle downstream computation if the data drifted past the protocol-defined horizon.

---

## ◊ How it ties into Proof-of-Context

PoC is a verification primitive that binds attestations to a freshness horizon and gates settlement against it. BaseOracle is a producer of `f_i`-typed PoC commitments.

Every paid endpoint response includes a `_poc` block:

```json
{
  "token": "ETH",
  "price_usd": 2500.0,
  "_poc": {
    "version": "0.1",
    "freshness_type": "f_i",
    "source_id": "baseoracle:default",
    "endpoint": "/api/v1/prices",
    "timestamp": "2026-04-30T19:30:00.000Z",
    "freshness_horizon_seconds": 30,
    "payload_hash": "...",
    "signature": "...",
    "public_key": "...",
    "anchors": {
      "server_timestamp": "2026-04-30T19:30:00.000Z",
      "block_height": null,
      "drand_round": null
    },
    "scope_disclaimer": "Operator vouches for freshness at timestamp of signing. Upstream source honesty is not attested."
  }
}
```

A consumer integrates `verify()` from `src/utils/poc.js` (or the equivalent in [`proof-of-context-impl`](https://github.com/asastuai/proof-of-context-impl) Rust crate) to check signature + freshness in one call.

The triple-anchor block (`block_height`, `drand_round`) is scaffolded for the next integration phase against `proof-of-context-impl`. For now the server timestamp is the binding clock.

---

## Endpoints

15 total. 5 free, 10 paid. All paid endpoints emit PoC `f_i` attestations in the response.

| Endpoint | Method | Price | PoC | Description |
|---|---|---|---|---|
| `/api/v1/info` | GET | Free | — | Service discovery, lists endpoints |
| `/api/v1/health` | GET | Free | — | Health check |
| `/api/v1/metrics` | GET | Free | — | Usage + cache stats |
| `/api/v1/poc/public-key` | GET | Free | — | Operator public key for attestation verification |
| `/api/v1/agents` | GET | Free | — | List registered agents |
| `/api/v1/agents/:address` | GET | Free | — | Lookup agent by address |
| `/api/v1/agents/register` | POST | Free | — | Register agent |
| `/api/v1/prices?token=X` | GET | $0.001 | `f_i`, 30s | Token price data |
| `/api/v1/prices/batch?tokens=X,Y` | GET | $0.001 | `f_i`, 30s | Batch prices |
| `/api/v1/trending` | GET | $0.002 | `f_i`, 60s | Trending tokens |
| `/api/v1/whale-alerts` | GET | $0.005 | `f_i`, 15s | Large transfers |
| `/api/v1/token-analysis` | GET | $0.005 | `f_i`, 60s | Security audit + holder analysis |
| `/api/v1/gas` | GET | $0.001 | `f_i`, 30s | Gas estimates |
| `/api/v1/portfolio` | GET | $0.003 | `f_i`, 60s | Wallet token balances |
| `/api/v1/wallet-profile` | GET | $0.005 | `f_i`, 120s | Wallet trading history |
| `/api/v1/ohlcv` | GET | $0.003 | `f_i`, 60s | Historical candles |
| `/api/v1/contract-verify` | GET | $0.010 | `f_i`, 600s | Smart contract safety |
| `/api/v1/route` | GET | $0.005 | `f_i`, 30s | DEX aggregator best route |

---

## Quick start

```bash
git clone https://github.com/asastuai/BaseOracle.git
cd BaseOracle
npm install

cp .env.example .env
# Required: PRIVATE_KEY, PAY_TO_ADDRESS
# Recommended for PoC attestation: POC_SIGNING_KEY
# Generate one with: npm run gen-poc-key

npm start
```

---

## Tests

```bash
npm test
```

13 tests passing. Coverage:

- 8 PoC primitive tests (attest, verify, payload tampering rejection, horizon expiry, missing signature, missing _poc block, public key derivation, scope_disclaimer presence).
- 5 endpoint smoke tests (info, health, metrics, poc/public-key, agents).

Tests use `node --test` (no external runner). Test data uses dummy keys, never touches mainnet.

---

## Architecture

```
AI Agent  →  HTTP GET + x402 payment  →  BaseOracle API  →  Data sources
                                                ↓
                                       Response + PoC f_i attestation
                                                ↓
                                       USDC → operator wallet
```

Every monetized endpoint returns `402 Payment Required` on the first request, with a payment challenge in the response header. The agent signs a USDC transfer authorization, retries with the payment attached, and receives the data plus the PoC attestation in the second response.

Self-hosted x402 facilitator (`src/local-facilitator.js`). No external facilitator dependency.

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Payments | x402 protocol (LocalFacilitator self-hosted) |
| PoC attestation | Ed25519 (`@noble/ed25519`) over SHA-256 canonical JSON |
| Data sources | DexScreener API, BaseScan API, on-chain via viem |
| Token | Clanker v4 on Base (Uniswap V4) |
| Chain | Base (Coinbase L2) |

---

## Generating a PoC signing key

```bash
npm run gen-poc-key
```

Output:

```
PRIVATE KEY (set as POC_SIGNING_KEY in .env):
  <64 hex chars>
PUBLIC KEY (publish this so consumers can verify attestations):
  <64 hex chars>
```

Set the private key in `.env`. Publish the public key so integrators can verify attestations against your operator identity.

If `POC_SIGNING_KEY` is unset, attestations are returned without a signature (still informational, but not cryptographically bound to the operator).

---

## Deploy

### Railway

1. Push code to GitHub.
2. Open [railway.app](https://railway.app). New Project. Deploy from GitHub repo.
3. Add env vars from `.env.example` (don't forget `POC_SIGNING_KEY`).
4. Railway auto-detects Node.js and runs `npm start`.
5. Grab the public URL.

### Token (`$ORACLE` on Clanker v4)

```bash
# 1. Upload logo to IPFS (use nft.storage)
# 2. Edit scripts/deploy-token.js with your IPFS CID
# 3. Run:
npm run deploy-token
```

---

## Status

| What runs | What is missing |
|---|---|
| Server starts. 15 endpoints wired through x402. PoC `f_i` attestation signing on all 11 paid endpoints. 13 tests passing. Local facilitator self-hosted. | Live mainnet deployment with real x402 traffic. Triple-anchor `block_height` + `drand_round` wiring. Rate limiting middleware. Zod input validation on query params. CORS allowlist for production. Structured logging. |

---

## Revenue model

- **x402 queries.** USDC goes directly to operator wallet per query.
- **LP fees.** Trading fees from `$ORACLE` on Clanker v4, claim at [clanker.world](https://clanker.world).
- **Buyback flywheel.** Query revenue buys back `$ORACLE`, tightening the supply loop.

---

## ❖ Part of Aletheia

BaseOracle is the data layer of [Aletheia](https://github.com/asastuai/aletheia). Five sibling repos compose the rest of the stack.

- [**Proof-of-Context**](https://github.com/asastuai/proof-of-context): verification spine. The primitive that types BaseOracle's response attestations.
- [**proof-of-context-impl**](https://github.com/asastuai/proof-of-context-impl): Rust reference implementation of PoC.
- [**SUR Protocol**](https://github.com/asastuai/sur-protocol): perp DEX. Consumer of BaseOracle data for agent trading.
- [**TrustLayer**](https://github.com/asastuai/TrustLayer): agent reputation. Aggregates PoC commitments from BaseOracle calls.
- [**PayClaw**](https://github.com/asastuai/payclaw): agent wallet. Holds the USDC an agent spends on BaseOracle queries.
- [**Vigil**](https://github.com/asastuai/vigil): DeFi intelligence. Sibling data layer for risk and MEV signals.

---

## License

MIT. Please see [LICENSE](LICENSE).

---

Built by [Juan Cruz Maisú](https://github.com/asastuai). Buenos Aires, Argentina.

Juan Cruz Maisú ♥
