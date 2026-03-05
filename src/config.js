import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",

  // Wallet
  privateKey: process.env.PRIVATE_KEY,
  payToAddress: process.env.PAY_TO_ADDRESS,

  // Network
  baseRpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",

  // API Keys
  basescanApiKey: process.env.BASESCAN_API_KEY,
  clankerApiKey: process.env.CLANKER_API_KEY,

  // x402
  facilitatorUrl:
    process.env.X402_FACILITATOR_URL ||
    "https://api.cdp.coinbase.com/platform/v2/x402",

  // USDC on Base mainnet
  usdcAddress:
    process.env.USDC_BASE_ADDRESS ||
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",

  // Base chain ID (CAIP-2 format)
  network: "eip155:8453",

  // Cache TTL (seconds)
  cacheTtl: {
    prices: parseInt(process.env.CACHE_TTL_PRICES || "30"),
    trending: parseInt(process.env.CACHE_TTL_TRENDING || "60"),
    whales: parseInt(process.env.CACHE_TTL_WHALES || "15"),
  },


  // Game frontend defaults
  game: {
    chainId: parseInt(process.env.GAME_CHAIN_ID || "84532"),
    chainName: process.env.GAME_CHAIN_NAME || "Base Sepolia",
    contractAddress: process.env.GAME_CONTRACT_ADDRESS || "",
    rpcUrl: process.env.GAME_RPC_URL || "https://sepolia.base.org",
    blockExplorerUrl: process.env.GAME_BLOCK_EXPLORER_URL || "https://sepolia.basescan.org",
  },

  // Pricing per endpoint (USDC)
  pricing: {
    prices: "$0.001",
    trending: "$0.002",
    whaleAlerts: "$0.005",
    sentiment: "$0.003",
    agentScore: "$0.005",
    tokenScanner: "$0.005",
  },
};

// Validate required env vars
const required = ["PAY_TO_ADDRESS"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    console.error(`   Copy .env.example to .env and fill in your values.`);
    process.exit(1);
  }
}
