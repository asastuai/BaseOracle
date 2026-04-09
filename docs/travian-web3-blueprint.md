# Blueprint: estrategia tipo navegador en versión Web3 (sin infringir IP)

Este blueprint te permite crear un juego **inspirado en el loop clásico de estrategia**, pero sin copiar arte, nombres, texto, mapa ni balance exacto del juego original.

## 1) Regla legal práctica (importante)

Para evitar problemas de derechos:

- No uses marca/nombre/logo del juego original.
- No copies assets visuales (UI, íconos, unidades, edificios, textos).
- No clones exactamente números de balance, árbol tecnológico o facciones.
- Crea identidad propia: universo, razas, arte, narrativa y UX.

## 2) Arquitectura recomendada

- **Frontend**: Next.js + wagmi/viem (wallet connect).
- **Backend indexador**: Node + PostgreSQL + Redis (estadísticas y ranking).
- **Smart contracts (Base / Base Sepolia)**:
  - `EmpireChainGame.sol` (estado de aldea, recursos, tropas, combate básico).
  - Contrato opcional NFT para héroes/skines (si quieres economía avanzada).
- **Infra**:
  - RPC provider (Alchemy/Infura/Base public RPC).
  - Subgraph o indexador propio para eventos.
  - Deploy de frontend en Vercel/Netlify, backend en Railway/Fly.

## 3) Lo que ya te dejé en este repo

Carpeta `web3/` lista para empezar:

- `contracts/EmpireChainGame.sol`.
- `scripts/deploy.cjs`.
- `test/EmpireChainGame.test.cjs`.
- `hardhat.config.cjs` con red Base Sepolia.

## 4) Cómo desplegar contrato

```bash
cd web3
npm install
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export DEPLOYER_PRIVATE_KEY="0xTU_PRIVATE_KEY"
npm run compile
npm test
npm run deploy:base-sepolia
```

## 5) Integración wallet (frontend)

Flujo mínimo:

1. Usuario conecta wallet (MetaMask o WalletConnect).
2. Si no tiene aldea: llama `createVillage()`.
3. Botón “Claim”: llama `claimResources()`.
4. Botón “Entrenar”: llama `queueTraining(warriors, defenders)`.
5. Botón “Finalizar entrenamiento”: `finalizeTraining()`.
6. Botón “Atacar”: `attack(target, warriorsSent, defendersSent)`.

## 6) Roadmap para hacerlo “casi igual de adictivo” (pero original)

- Mapa hexagonal procedural (off-chain) + ownership/acciones críticas on-chain.
- Sistema de temporadas (reseteo parcial + recompensas NFT).
- Matchmaking por ligas (anti-ballenas).
- Crafting y mercado P2P con tasas anti-bot.
- Misiones PvE para onboarding sin fricción.

## 7) Siguiente paso recomendado

Si quieres, te puedo preparar el siguiente sprint con:

- frontend React con wallet integrada,
- panel visual de aldea y recursos en tiempo real,
- script de deploy + verificación de contrato en BaseScan,
- y pipeline CI/CD para dejarlo productivo.
