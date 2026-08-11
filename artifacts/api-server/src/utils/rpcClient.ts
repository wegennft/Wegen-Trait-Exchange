/**
 * Minimal JSON-RPC client for on-chain payment verification.
 * No ethers or viem dependency — uses plain fetch so the bundle stays lean.
 */

/** Convert network name stored in store_settings to an EVM chain ID */
export function networkNameToChainId(networkName: string | null | undefined): number {
  switch ((networkName ?? "mainnet").toLowerCase()) {
    case "mainnet":
    case "ethereum":
      return 1;
    case "base":
      return 8453;
    case "base-sepolia":
      return 84532;
    case "polygon":
    case "matic":
      return 137;
    case "sepolia":
      return 11155111;
    case "goerli":
      return 5;
    default:
      return 1;
  }
}

/** Return the RPC URL to use for verification, or null if unconfigured (dev mode). */
export function getRpcUrl(chainId: number): string | null {
  // Explicit RPC URL takes priority
  if (process.env.RPC_URL) return process.env.RPC_URL;

  // Alchemy-based URL if API key is set
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (apiKey) {
    switch (chainId) {
      case 1:    return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
      case 8453: return `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
      case 84532:return `https://base-sepolia.g.alchemy.com/v2/${apiKey}`;
      case 137:  return `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`;
      case 11155111: return `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;
      default:   return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
    }
  }

  return null;
}

interface RpcResponse<T> {
  result: T | null;
  error?: { code: number; message: string };
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T | null> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as RpcResponse<T>;
  return data.result ?? null;
}

export interface VerifyResult {
  /** True if the tx exists, is confirmed, goes to the right address, and carries enough value. */
  valid: boolean;
  reason?: string;
  /** Actual value sent in wei (as a bigint string). */
  valueWei?: string;
}

/**
 * Verify that a transaction:
 * 1. Is mined and not reverted
 * 2. Sends ETH to `expectedTo`
 * 3. Carries at least `minValueWei` (pass 0n to skip value check)
 *
 * Returns `{ valid: true }` without making any RPC calls when RPC is unconfigured
 * (dev / no-RPC mode), so the app degrades gracefully.
 */
export async function verifyPaymentTx(
  txHash: string,
  expectedTo: string,
  chainId: number,
  minValueWei: bigint = 0n,
): Promise<VerifyResult> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    // No RPC configured — skip verification.
    // Set RPC_URL or ALCHEMY_API_KEY to enable on-chain verification in production.
    console.warn(
      "[payment] RPC_URL / ALCHEMY_API_KEY not set — skipping on-chain tx verification. " +
        "Set one of these secrets to enforce real payment verification.",
    );
    return { valid: true };
  }

  // Check receipt first (proves the tx is mined and not reverted)
  const receipt = await rpcCall<{ status: string }>(rpcUrl, "eth_getTransactionReceipt", [txHash]);
  if (!receipt) {
    return { valid: false, reason: "Transaction not found or not yet confirmed. Wait for a block confirmation and retry." };
  }
  if (receipt.status !== "0x1") {
    return { valid: false, reason: "Transaction was reverted on-chain." };
  }

  // Fetch the tx body to check to/value
  const tx = await rpcCall<{ to: string | null; value: string }>(
    rpcUrl,
    "eth_getTransactionByHash",
    [txHash],
  );
  if (!tx) {
    return { valid: false, reason: "Could not fetch transaction data." };
  }

  if (!tx.to || tx.to.toLowerCase() !== expectedTo.toLowerCase()) {
    return {
      valid: false,
      reason: `Payment sent to ${tx.to ?? "(none)"}, expected ${expectedTo}. Contact support.`,
    };
  }

  const valueWei = BigInt(tx.value ?? "0x0");
  if (minValueWei > 0n && valueWei < minValueWei) {
    return {
      valid: false,
      reason: `Payment amount too low (received ${valueWei} wei, expected at least ${minValueWei} wei).`,
    };
  }

  return { valid: true, valueWei: valueWei.toString() };
}
