import {
  BrowserProvider,
  Eip1193Provider,
  getAddress,
  hexlify,
  toUtf8Bytes,
} from "ethers";
import type { ConnectStep } from "./types";

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
    msg.includes("coalesce")
  );
}

function formatWalletError(err: unknown): string {
  if (isUserRejection(err)) {
    return "You declined the sign-in request in your wallet.";
  }
  const msg = (err as { message?: string }).message ?? String(err);
  if (msg.toLowerCase().includes("coalesce") || msg.includes("-32000")) {
    return (
      "Your wallet could not sign the login message. Make sure the correct account is selected in MetaMask, " +
      "then try again. If it keeps failing, disconnect this site from MetaMask and reconnect."
    );
  }
  return msg.length > 200 ? "Wallet sign-in failed. Please try again." : msg;
}

async function signSiweMessage(
  provider: Eip1193Provider,
  raw: RawProvider,
  message: string,
  signingAddress: string,
): Promise<string> {
  const checksum = getAddress(signingAddress);

  // 1. MetaMask / WalletConnect — UTF-8 message + checksummed address
  try {
    return (await raw.request({
      method: "personal_sign",
      params: [message, checksum],
    })) as string;
  } catch (utf8Err) {
    if (isUserRejection(utf8Err)) throw utf8Err;
  }

  // 2. Hex-encoded message (Phantom, Backpack, some WC wallets)
  try {
    const hexMsg = hexlify(toUtf8Bytes(message));
    return (await raw.request({
      method: "personal_sign",
      params: [hexMsg, checksum],
    })) as string;
  } catch (hexErr) {
    if (isUserRejection(hexErr)) throw hexErr;
  }

  // 3. ethers signer fallback
  const browserProvider = new BrowserProvider(provider);
  const signer = await browserProvider.getSigner(checksum);
  return signer.signMessage(message);
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
): Promise<SiweResult> {
  const raw = provider as unknown as RawProvider;

  onStep?.("requesting");
  const accounts = (await raw.request({
    method: "eth_requestAccounts",
    params: [],
  })) as string[];
  if (!accounts.length) throw new Error("No accounts returned from wallet");

  const chainHex = (await raw.request({ method: "eth_chainId" })) as string;
  const chainId = parseInt(chainHex, 16).toString();

  let signature = "";
  let address = "";
  let message = "";
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const freshAccounts = (await raw.request({ method: "eth_accounts" })) as string[];
    const rawAddress = freshAccounts[0] ?? accounts[0];
    const signingAddress = getAddress(rawAddress);
    address = signingAddress.toLowerCase();

    const nonceRes = await fetch(
      `/api/auth/nonce?address=${encodeURIComponent(signingAddress)}&chainId=${encodeURIComponent(chainId)}`,
    );
    if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
    const nonceData = (await nonceRes.json()) as { nonce: string; message: string };
    message = nonceData.message;

    onStep?.("signing");
    try {
      signature = await signSiweMessage(provider, raw, message, signingAddress);
      lastError = undefined;
      break;
    } catch (signErr) {
      lastError = signErr;
      if (isUserRejection(signErr)) throw signErr;
      if (isRetryableSignError(signErr) && attempt === 0) continue;
      throw Object.assign(new Error(formatWalletError(signErr)), {
        code: (signErr as { code?: number }).code,
      });
    }
  }

  if (lastError) {
    throw Object.assign(new Error(formatWalletError(lastError)), { code: -32000 });
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
