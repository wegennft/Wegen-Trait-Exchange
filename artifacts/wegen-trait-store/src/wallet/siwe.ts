import { Eip1193Provider, getAddress, hexlify, toUtf8Bytes } from "ethers";
import type { ConnectStep, WalletId } from "./types";
import {
  formatWalletError,
  isSignFailure,
  isUserRejection,
  toWalletError,
} from "./wallet-errors";

type RawProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function uniquePairs(pairs: [string, string][]): [string, string][] {
  const seen = new Set<string>();
  return pairs.filter(([a, b]) => {
    const key = `${a}|${b}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
      attempts.push([hexMsg, from]);
      attempts.push([message, from]);
    } else {
      attempts.push([message, from]);
      attempts.push([hexMsg, from]);
    }
  }

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

/** Phantom docs: personal_sign with plain message + exact account from eth_requestAccounts. */
async function signWithPhantom(raw: RawProvider, message: string): Promise<string> {
  const accounts = (await raw.request({
    method: "eth_requestAccounts",
    params: [],
  })) as string[];
  if (!accounts.length) {
    throw new Error(
      "No Ethereum account in Phantom. Open Phantom, switch to Ethereum (top-left), then retry.",
    );
  }

  const from = accounts[0];
  const hexMsg = hexlify(toUtf8Bytes(message));

  for (const params of [
    [message, from] as [string, string],
    [hexMsg, from],
    [from, message],
    [from, hexMsg],
  ]) {
    try {
      return (await raw.request({ method: "personal_sign", params })) as string;
    } catch (err) {
      if (isUserRejection(err)) throw err;
    }
  }

  throw toWalletError(new Error("Phantom personal_sign failed"), "phantom");
}

async function signSiweMessage(
  provider: Eip1193Provider,
  raw: RawProvider,
  message: string,
  accountFromWallet: string,
  walletId?: WalletId,
): Promise<string> {
  if (walletId === "phantom") {
    return signWithPhantom(raw, message);
  }

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

  throw toWalletError(lastErr ?? new Error("personal_sign failed"), walletId);
}

export interface SiweResult {
  address: string;
  chainId: string;
}

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
      if (isSignFailure(signErr) && attempt === 0) continue;
      throw toWalletError(signErr, walletId);
    }
  }

  if (lastError) {
    throw toWalletError(lastError, walletId);
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
