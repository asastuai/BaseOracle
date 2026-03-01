/**
 * deploy-token.js
 *
 * Deploys $ORACLE token on Base via Clanker v4.
 *
 * BEFORE RUNNING:
 * 1. Fill in your .env (copy from .env.example)
 * 2. Make sure your wallet has ETH on Base for gas (~$5 worth)
 * 3. Upload your token logo to IPFS (use https://nft.storage or https://pinata.cloud)
 * 4. Update TOKEN_IMAGE below with your IPFS CID
 *
 * RUN:
 *   npm run deploy-token
 */

import dotenv from "dotenv";
dotenv.config();

import { Clanker } from "clanker-sdk/v4";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ============================================
// CONFIG — EDIT THESE
// ============================================

const TOKEN_NAME = "BaseOracle";
const TOKEN_SYMBOL = "ORACLE";
const TOKEN_DESCRIPTION =
  "Agent Data Oracle — pay-per-query data feeds for AI agents on Base. Powered by x402. The Bloomberg Terminal for autonomous agents.";

// Upload your logo to IPFS first, then paste the CID here
// Use https://nft.storage (free) or https://app.pinata.cloud
const TOKEN_IMAGE = "ipfs://YOUR_LOGO_CID_HERE";

// Social links (update with your actual handles)
const SOCIAL_LINKS = [
  "https://x.com/BaseOracleXYZ",
  "https://github.com/baseoracle",
];

// ============================================
// DEPLOYMENT
// ============================================

async function main() {
  console.log("🔮 Deploying $ORACLE on Base via Clanker v4...\n");

  // Setup wallet
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`📍 Deployer wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  });

  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  });

  // Check balance
  const balance = await publicClient.getBalance({
    address: account.address,
  });
  const ethBalance = Number(balance) / 1e18;
  console.log(`💰 ETH balance: ${ethBalance.toFixed(6)} ETH`);

  if (ethBalance < 0.001) {
    console.error("❌ Not enough ETH for gas. Need at least 0.001 ETH.");
    process.exit(1);
  }

  // Init Clanker SDK
  const clanker = new Clanker({ publicClient, wallet });

  console.log(`\n📋 Token Config:`);
  console.log(`   Name:   ${TOKEN_NAME}`);
  console.log(`   Symbol: ${TOKEN_SYMBOL}`);
  console.log(`   Image:  ${TOKEN_IMAGE}`);
  console.log(`   Fees:   Dynamic (1% base, 5% max)`);
  console.log(`   Vault:  15% supply, 30d lock + 30d vest`);
  console.log(`   Rewards: 80% creator (WETH) / 20% treasury (Both)`);
  console.log();

  // ============================================
  // DEPLOY
  // ============================================

  const { txHash, waitForTransaction, error } = await clanker.deploy({
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    image: TOKEN_IMAGE,
    tokenAdmin: account.address,

    metadata: {
      description: TOKEN_DESCRIPTION,
      socialMediaUrls: SOCIAL_LINKS,
    },

    context: {
      interface: "Clanker SDK",
    },

    // Generate a vanity address with "b07" suffix (optional, looks cool)
    vanity: true,

    // Dynamic fees: 1% base, up to 5% during high volatility
    fees: {
      type: "dynamic",
      baseFee: 100,   // 1.00% in bps
      maxFee: 500,    // 5.00% max in bps
    },

    // Vault 15% of supply for treasury
    vault: {
      percentage: 15,
      lockupDuration: 2592000, // 30 days in seconds
      vestingDuration: 2592000, // 30 days linear vest after unlock
      recipient: account.address,
    },

    // Fee distribution
    rewards: {
      recipients: [
        {
          // YOU — 80% of all trading fees, paid in WETH
          recipient: account.address,
          admin: account.address,
          bps: 8000, // 80%
          token: "Paired", // WETH
        },
        {
          // TREASURY — 20% of fees in both tokens (for buyback)
          // Set this to a separate wallet or multisig
          // For now, same address (change later via admin)
          recipient: account.address,
          admin: account.address,
          bps: 2000, // 20%
          token: "Both",
        },
      ],
    },

    // Anti-sniper: descending fee auction on first swaps
    sniperFees: {
      startingFee: 500000, // 50% starting fee
      endingFee: 10000,    // 1% ending fee
      secondsToDecay: 30,  // Decays over 30 seconds
    },
  });

  if (error) {
    console.error("❌ Deploy failed:", error);
    process.exit(1);
  }

  console.log(`✅ Transaction sent: ${txHash}`);
  console.log(`   Waiting for confirmation...`);

  const result = await waitForTransaction();

  console.log(`\n🎉 $ORACLE DEPLOYED SUCCESSFULLY!`);
  console.log(`══════════════════════════════════════`);
  console.log(`   Token Address: ${result.address}`);
  console.log(`   TX Hash:       ${txHash}`);
  console.log(`   Basescan:      https://basescan.org/token/${result.address}`);
  console.log(`   Clanker:       https://www.clanker.world/clanker/${result.address}`);
  console.log(`   DexScreener:   https://dexscreener.com/base/${result.address}`);
  console.log(`══════════════════════════════════════`);
  console.log(`\n📝 NEXT STEPS:`);
  console.log(`   1. Update .env with the token address`);
  console.log(`   2. Update /api/v1/info endpoint with token link`);
  console.log(`   3. Claim fees at: https://www.clanker.world/clanker/${result.address}/admin`);
  console.log(`   4. Start the API server: npm start`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
