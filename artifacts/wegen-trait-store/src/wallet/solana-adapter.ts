/**
 * Solana wallet adapter.
 *
 * Keeps ALL Solana logic isolated from EVM logic. This module never
 * imports ethers or anything EVM-specific.
 *
 * Supported wallets (via their injected `window.*` namespaces):
 *   – Phantom  (window.phantom.solana)
 *   – Backpack (window.backpack.solana)
 *   – OKX     (window.okxwallet.solana)  — partial support
 *
 * SECURITY NOTES:
 *   ✗ No private keys, seed phrases, or mnemonics are ever requested.
 *   ✗ No sensitive data is logged.
 *   ✓ Every action requires explicit user approval in the wallet.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SolanaProvider {
  isPhantom?: boolean;
  isBackpack?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: "utf8"): Promise<{ signature: Uint8Array }>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
}

export type SolanaWalletId = "phantom-sol" | "backpack-sol" | "okx-sol";

export interface DetectedSolanaWallet {
  id: SolanaWalletId;
  name: string;
  provider: SolanaProvider;
}

type SolanaWindow = Window & {
  phantom?: { solana?: SolanaProvider };
  backpack?: { solana?: SolanaProvider };
  okxwallet?: { solana?: SolanaProvider };
};

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Returns all detected native Solana wallet providers, deduplicated.
 * Returns an empty array when none are installed (never throws).
 */
export function detectSolanaWallets(): DetectedSolanaWallet[] {
  if (typeof window === "undefined") return [];
  const w = window as SolanaWindow;
  const results: DetectedSolanaWallet[] = [];
  const seen = new Set<unknown>();

  const tryAdd = (id: SolanaWalletId, name: string, provider: SolanaProvider | undefined) => {
    if (!provider?.connect || seen.has(provider)) return;
    seen.add(provider);
    results.push({ id, name, provider });
  };

  tryAdd("phantom-sol",  "Phantom (Solana)",  w.phantom?.solana);
  tryAdd("backpack-sol", "Backpack (Solana)",  w.backpack?.solana);
  tryAdd("okx-sol",      "OKX (Solana)",       w.okxwallet?.solana);

  return results;
}

// ─── Connect ─────────────────────────────────────────────────────────────────

/**
 * Requests account access from a Solana provider.
 * Returns the base58 public key string on success.
 *
 * Throws:
 *  – code 4001  if the user rejects the connection request
 *  – generic Error for any other failure
 */
export async function connectSolanaWallet(provider: SolanaProvider): Promise<string> {
  const resp = await provider.connect();
  const address = resp.publicKey.toString();
  if (!address) throw new Error("Solana wallet returned an empty public key");
  return address;
}

// ─── Sign ────────────────────────────────────────────────────────────────────

/**
 * Signs an arbitrary message with the Solana wallet.
 * Returns the base58-encoded signature string.
 *
 * NOTE: This is for future on-chain verification. The current API server
 * only supports EVM SIWE auth. Solana signing will be wired in when the
 * server adds a Solana verify endpoint.
 */
export async function signSolanaMessage(
  provider: SolanaProvider,
  message: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const { signature } = await provider.signMessage(enc.encode(message), "utf8");
  return signature;
}

// ─── Stale session / disconnect ───────────────────────────────────────────────

/**
 * Attempts a silent reconnect (onlyIfTrusted = true).
 * Returns the public key if already trusted, null otherwise.
 * Never prompts the user.
 */
export async function restoreSolanaSession(provider: SolanaProvider): Promise<string | null> {
  try {
    const resp = await provider.connect({ onlyIfTrusted: true });
    return resp.publicKey.toString() || null;
  } catch {
    return null;
  }
}
