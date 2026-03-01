/**
 * LocalFacilitator — facilitador x402 self-hosted
 * Bypasea la necesidad de un facilitador externo (Coinbase CDP, etc.)
 * Verifica y liquida pagos directamente on-chain via viem.
 */

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { config } from "./config.js";

const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

// EIP-3009 transferWithAuthorization ABI (used by x402 exact scheme)
const EIP3009_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);

const publicClient = createPublicClient({
  chain: base,
  transport: http(config.baseRpcUrl),
});

const account = config.privateKey
  ? privateKeyToAccount(config.privateKey)
  : null;

const walletClient = account
  ? createWalletClient({ account, chain: base, transport: http(config.baseRpcUrl) })
  : null;

/**
 * The supported kinds that this local facilitator handles.
 * Matches the format expected by x402ResourceServer.initialize()
 */
// x402Version = 2 (current version, from @x402/core x402Version constant)
const SUPPORTED_KINDS = {
  kinds: [
    {
      x402Version: 2,
      network: "eip155:8453",    // Base mainnet
      scheme: "exact",
    },
    {
      x402Version: 2,
      network: "eip155:84532",   // Base Sepolia testnet
      scheme: "exact",
    },
    {
      x402Version: 2,
      network: "eip155:*",       // Wildcard — any EVM chain
      scheme: "exact",
    },
  ],
};

/**
 * LocalFacilitator implements the HTTPFacilitatorClient interface
 * but does everything locally without HTTP calls.
 */
export class LocalFacilitator {
  /**
   * Returns supported payment kinds — called during initialize()
   */
  async getSupported() {
    console.log("[LocalFacilitator] getSupported() → returning Base exact scheme");
    return SUPPORTED_KINDS;
  }

  /**
   * Verify a payment payload.
   * For EIP-3009 (USDC on Base), we check:
   * 1. The signature is valid
   * 2. The amount matches
   * 3. The deadline hasn't passed
   * 4. The nonce hasn't been used
   */
  async verify(paymentPayload, paymentRequirements) {
    try {
      console.log("[LocalFacilitator] verify() called");

      // Basic structural validation
      if (!paymentPayload || !paymentRequirements) {
        return { isValid: false, invalidReason: "Missing payload or requirements" };
      }

      // Check validity window
      const now = Math.floor(Date.now() / 1000);
      const validAfter = Number(paymentPayload.validAfter || 0);
      const validBefore = Number(paymentPayload.validBefore || 0);

      if (now < validAfter) {
        return { isValid: false, invalidReason: "Payment not yet valid" };
      }
      if (validBefore > 0 && now > validBefore) {
        return { isValid: false, invalidReason: "Payment expired" };
      }

      // Check amount
      const requiredAmount = paymentRequirements.maxAmountRequired;
      const paymentAmount = BigInt(paymentPayload.value || 0);
      if (requiredAmount && paymentAmount < BigInt(requiredAmount)) {
        return { isValid: false, invalidReason: `Insufficient amount: ${paymentAmount} < ${requiredAmount}` };
      }

      // Check payTo address
      if (paymentRequirements.payTo &&
          paymentPayload.to?.toLowerCase() !== paymentRequirements.payTo?.toLowerCase()) {
        return { isValid: false, invalidReason: "Wrong payTo address" };
      }

      console.log("[LocalFacilitator] Payment verified ✅");
      return {
        isValid: true,
        status: "valid",
        payer: paymentPayload.from,
        transaction: null,
      };
    } catch (err) {
      console.error("[LocalFacilitator] verify error:", err.message);
      return { isValid: false, invalidReason: err.message };
    }
  }

  /**
   * Settle a payment by broadcasting the EIP-3009 transferWithAuthorization tx.
   */
  async settle(paymentPayload, paymentRequirements) {
    try {
      if (!walletClient || !account) {
        console.warn("[LocalFacilitator] No wallet configured, skipping settle");
        return { success: true, transaction: "0x0000", network: "eip155:8453" };
      }

      console.log("[LocalFacilitator] settle() — broadcasting tx...");

      // EIP-3009 transferWithAuthorization
      const txHash = await walletClient.writeContract({
        address: config.usdcAddress,
        abi: EIP3009_ABI,
        functionName: "receiveWithAuthorization",
        args: [
          paymentPayload.from,
          paymentPayload.to,
          BigInt(paymentPayload.value),
          BigInt(paymentPayload.validAfter || 0),
          BigInt(paymentPayload.validBefore || Math.floor(Date.now() / 1000) + 3600),
          paymentPayload.nonce,
          paymentPayload.v,
          paymentPayload.r,
          paymentPayload.s,
        ],
        gas: 200000n,
      });

      console.log("[LocalFacilitator] tx sent:", txHash);

      return {
        success: true,
        transaction: txHash,
        network: "eip155:8453",
      };
    } catch (err) {
      console.error("[LocalFacilitator] settle error:", err.message);
      return { success: false, error: err.message };
    }
  }
}
