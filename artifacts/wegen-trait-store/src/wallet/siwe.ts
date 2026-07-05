import { BrowserProvider, Eip1193Provider, hexlify, toUtf8Bytes } from "ethers";
import type { ConnectStep } from "./types";

type RawProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function isAddressMismatchError(err: unknown): boolean {
  const code = (err as { code?: number }).code;
  const msg = ((err as { message?: string }).message ?? "").toLowerCase();
  return (
    (code === -32000 || code === 32000 || code === 4200) &&
    (msg.includes("does not match") || msg.includes("address"))
  );
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
    address = rawAddress.toLowerCase();

    const nonceRes = await fetch(
      `/api/auth/nonce?address=${encodeURIComponent(address)}&chainId=${encodeURIComponent(chainId)}`,
    );
    if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
    const nonceData = (await nonceRes.json()) as { nonce: string; message: string };
    message = nonceData.message;

    onStep?.("signing");
    try {
      const browserProvider = new BrowserProvider(provider);
      const signer = await browserProvider.getSigner();
      signature = await signer.signMessage(message);
      lastError = undefined;
      break;
    } catch (signErr) {
      const code = (signErr as { code?: number }).code;
      if (code === -32000 || code === 32000 || code === 4200) {
        try {
          const hexMsg = hexlify(toUtf8Bytes(message));
          signature = (await raw.request({
            method: "personal_sign",
            params: [hexMsg, rawAddress],
          })) as string;
          lastError = undefined;
          break;
        } catch (fallbackErr) {
          lastError = fallbackErr;
          if (isAddressMismatchError(fallbackErr) && attempt === 0) continue;
          throw fallbackErr;
        }
      } else {
        lastError = signErr;
        if (isAddressMismatchError(signErr) && attempt === 0) continue;
        throw signErr;
      }
    }
  }

  if (lastError) {
    throw Object.assign(
      new Error(
        "Your wallet reported a different account than the one being verified. " +
          "Please make sure the correct account is selected in your wallet, then try connecting again.",
      ),
      { code: -32000 },
    );
  }

  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, message, signature }),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Signature verification failed");
  }

  return { address, chainId };
}
