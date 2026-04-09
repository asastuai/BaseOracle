# Frontend Web3 listo para hosting

Sí: ya quedó construido un frontend base en `public/game/` y se sirve desde el backend Express en la ruta `/game`.

## Qué incluye ahora

- Conexión de wallet con MetaMask usando `ethers` (CDN).
- Cambio de red automático a Base Sepolia (`wallet_switchEthereumChain`).
- Carga de configuración desde `GET /api/v1/game-config`.
- Configuración manual y persistencia de dirección de contrato (`localStorage`).
- Acciones del contrato: `createVillage`, `claimResources`, `queueTraining`, `finalizeTraining`, `attack`.
- Vista de estado de tu aldea + scouting de wallet target + log de transacciones.

## Variables para publicar fácil

Define estas variables en tu plataforma de hosting:

- `PAY_TO_ADDRESS` (requerida para levantar backend actual)
- `GAME_CHAIN_ID` (ej: `84532`)
- `GAME_CHAIN_NAME` (ej: `Base Sepolia`)
- `GAME_CONTRACT_ADDRESS` (dirección desplegada de `EmpireChainGame`)
- `GAME_RPC_URL` (ej: `https://sepolia.base.org`)
- `GAME_BLOCK_EXPLORER_URL` (ej: `https://sepolia.basescan.org`)

## Probar local

```bash
PAY_TO_ADDRESS=0x1111111111111111111111111111111111111111 \
GAME_CONTRACT_ADDRESS=0xYourContract \
npm start
# abrir http://localhost:3000/game
```

## Hosting (Railway)

1. Push a GitHub.
2. Railway → New Project → Deploy from GitHub.
3. Configura las variables anteriores.
4. Deploy.
5. URL pública final: `https://tu-app.up.railway.app/game`

> Nota: yo no puedo dejarlo hosteado permanentemente desde este entorno, pero te lo dejé listo para deploy inmediato en Railway/Vercel/Fly.
