import type { WalletId } from "./types";
import { hasMultipleEvmWallets } from "./eip6963";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

function errorCode(err: unknown): number | string | undefined {
  return (err as { code?: number | string }).code;
}

export function isUserRejection(err: unknown): boolean {
  const code = errorCode(err);
  return code === 4001 || code === "ACTION_REJECTED";
}

export function isSignFailure(err: unknown): boolean {
  if (isUserRejection(err)) return false;
  const msg = errorMessage(err).toLowerCase();
  const code = errorCode(err);
  return (
    code === -32000 ||
    code === 32000 ||
    code === 4200 ||
    msg.includes("coalesce") ||
    msg.includes("-32000") ||
    msg.includes("does not match") ||
    msg.includes("not authorized")
  );
}

/** Human-readable message for wallet connect / sign errors — never show raw JSON. */
export function formatWalletError(err: unknown, walletId?: WalletId): string {
  if (isUserRejection(err)) {
    return "You declined the sign-in request in your wallet.";
  }

  const msg = errorMessage(err);
  const lower = msg.toLowerCase();

  if (lower.includes("coalesce") || msg.includes("-32000") || lower.includes("could not sign")) {
    if (walletId === "phantom") {
      const multiHint = hasMultipleEvmWallets()
        ? " With Rabby installed, click Rabby in the wallet list instead."
        : "";
      return (
        "Phantom could not open the sign-in prompt. In Phantom, switch to your Ethereum account " +
        "(top-left picker) on Ethereum Mainnet, then try again." +
        multiHint
      );
    }
    if (walletId === "rabby") {
      return "Rabby could not sign the login message. Confirm the correct account is selected, then try again.";
    }
    return (
      "Your wallet could not sign the login message. Make sure the correct account is selected, " +
      "then try again. If it keeps failing, disconnect this site from the wallet and reconnect."
    );
  }

  if (msg.length > 160 || msg.includes("{") || (msg.includes("0x") && msg.length > 80)) {
    return "Wallet sign-in failed. Please try again or pick a different wallet.";
  }

  return msg;
}

export function toWalletError(err: unknown, walletId?: WalletId): Error {
  const formatted = formatWalletError(err, walletId);
  const code = isSignFailure(err) ? -32000 : errorCode(err);
  return Object.assign(new Error(formatted), { code: code ?? -32000 });
}
