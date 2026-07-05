import {
  BrowserProvider,
  Eip1193Provider,
  getAddress,
  hexlify,
  toUtf8Bytes,
} from "ethers";
import type { ConnectStep, WalletId } from "./types";
import { hasMultipleEvmWallets } from "./evm-wallets";

type RawProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function isUserRejection(err: unknown): boolean {
  const code = (err as { code?: number | string }).code;
  return code === 4001 || code === "ACTION_REJECTED";
}

function isRetryableSignError(err: unknown): boolean {
  if (isUserRejection(err)) return false;
  const code = (err as { code?: number }).code;
  const msg = ((err as { message?: string }).message ?? "").toLowerCase();
  return (
    code === -32000 ||
    code === 32000 ||
    code === 4200 ||
    msg.includes("does not match") ||
    msg.includes("address") ||
    msg.includes("coalesce") ||
    msg.includes("not authorized")
  );
}

function formatWalletError(err: unknown, walletId?: WalletId): string {
  if (isUserRejection(err)) {
    return "You declined the sign-in request in your wallet.";
  }
  const msg = (err as { message?: string }).message ?? String(err);
  if (msg.toLowerCase().includes("coalesce") || msg.includes("-32000")) {
    if (walletId === "phantom") {
      const multiHint = hasMultipleEvmWallets()
        ? " With Rabby installed, try clicking Rabby instead, or pick Phantom from Rabby's wallet list."
        : "";
      return (
        "Phantom could not sign the login message. Switch to your Ethereum account in Phantom " +
        "(top-left picker) on Ethereum Mainnet, then try again." +
        multiHint
      );
    }
    if (walletId === "rabby") {
      return (
        "Rabby could not sign the login message. Confirm the correct account is selected in Rabby, " +
        "then try again."
      );
    }
    return (
      "Your wallet could not sign the login message. Make sure the correct account is selected, " +
      "then try again. If it keeps failing, disconnect this site from the wallet and reconnect."
    );
  }
  return msg.length > 200 ? "Wallet sign-in failed. Please try again." : msg;
}

function uniquePairs(pairs: [string, string][]): [string, string][] {
  const seen = new Set<string>();
  return pairs.filter(([a, b]) => {
    const key = `${a}|${b}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Build personal_sign param attempts — wallets disagree on address casing and param order. */
function buildSignAttempts(
  message: string,
  hexMsg: string,
  accountFromWallet: string,
  checksum: string,
  walletId?: WalletId,
): [string, string][] {
  const lower = accountFromWallet.toLowerCase();
  const preferRawFrom = walletId === "phantom" || walletId === "backpack";
  const fromOrder = preferRawFrom
    ? [accountFromWallet, lower, checksum]
    : [checksum, accountFromWallet, lower];

  const attempts: [string, string][] = [];
  for (const from of fromOrder) {
    if (preferRawFrom) {
      // Phantom / Backpack — hex-encoded message per EIP-1474 first
      attempts.push([hexMsg, from]);
      attempts.push([message, from]);
    } else {
      attempts.push([message, from]);
      attempts.push([hexMsg, from]);
    }
  }

  // Some wallets (Phantom, Backpack, legacy) accept [address, message]
  if (preferRawFrom) {
    for (const from of fromOrder) {
      attempts.push([from, message]);
      attempts.push([from, hexMsg]);
    }
  }

  return uniquePairs(attempts);
}

const ACCEPTED_CHAIN_HEX = new Set(["0x1", "0xaa36a7"]);

async function ensureAcceptedChain(raw: RawProvider, chainHex: string): Promise<string> {
  if (ACCEPTED_CHAIN_HEX.has(chainHex.toLowerCase())) return chainHex;
  try {
    await raw.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1" }],
    });
    return (await raw.request({ method: "eth_chainId" })) as string;
  } catch {
    return chainHex;
  }
}

async function signSiweMessage(
  provider: Eip1193Provider,
  raw: RawProvider,
  message: string,
  accountFromWallet: string,
  walletId?: WalletId,
): Promise<string> {
  const checksum = getAddress(accountFromWallet);
  const hexMsg = hexlify(toUtf8Bytes(message));
  const attempts = buildSignAttempts(message, hexMsg, accountFromWallet, checksum, walletId);

  let lastErr: unknown;
  for (const params of attempts) {
    try {
      return (await raw.request({
        method: "personal_sign",
        params,
      })) as string;
    } catch (err) {
      lastErr = err;
      if (isUserRejection(err)) throw err;
    }
  }

  // ethers signer fallback — use exact account the wallet returned
  try {
    const browserProvider = new BrowserProvider(provider);
    const signer = await browserProvider.getSigner(accountFromWallet);
    return signer.signMessage(message);
  } catch (signerErr) {
    if (isUserRejection(signerErr)) throw signerErr;
    throw lastErr ?? signerErr;
  }
}

export interface SiweResult {
  address: string;
  chainId: string;
}

/**
 * Connect an EVM provider and complete SIWE sign-in with the API.
 * Used by injected wallets and WalletConnect alike.
 */
export async function signInWithEvmProvider(
  provider: Eip1193Provider,
  onStep?: (step: ConnectStep) => void,
  walletId?: WalletId,
): Promise<SiweResult> {
  const raw = provider as unknown as RawProvider;

  onStep?.("requesting");
  const accounts = (await raw.request({
    method: "eth_requestAccounts",
    params: [],
  })) as string[];
  if (!accounts.length) throw new Error("No accounts returned from wallet");

  let chainHex = (await raw.request({ method: "eth_chainId" })) as string;
  chainHex = await ensureAcceptedChain(raw, chainHex);
  const chainId = parseInt(chainHex, 16).toString();

  let signature = "";
  let address = "";
  let message = "";
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const freshAccounts = (await raw.request({ method: "eth_accounts" })) as string[];
    const accountFromWallet = freshAccounts[0] ?? accounts[0];
    const signingAddress = getAddress(accountFromWallet);
    address = signingAddress.toLowerCase();

    const nonceRes = await fetch(
      `/api/auth/nonce?address=${encodeURIComponent(signingAddress)}&chainId=${encodeURIComponent(chainId)}`,
    );
    if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
    const nonceData = (await nonceRes.json()) as { nonce: string; message: string };
    message = nonceData.message;

    onStep?.("signing");
    try {
      signature = await signSiweMessage(
        provider,
        raw,
        message,
        accountFromWallet,
        walletId,
      );
      lastError = undefined;
      break;
    } catch (signErr) {
      lastError = signErr;
      if (isUserRejection(signErr)) throw signErr;
      if (isRetryableSignError(signErr) && attempt === 0) continue;
      throw Object.assign(new Error(formatWalletError(signErr, walletId)), {
        code: (signErr as { code?: number }).code,
      });
    }
  }

  if (lastError) {
    throw Object.assign(new Error(formatWalletError(lastError, walletId)), { code: -32000 });
  }

  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ address, message, signature }),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Signature verification failed");
  }

  return { address, chainId };
}
