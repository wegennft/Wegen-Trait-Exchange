import type { Request, Response, NextFunction } from "express";

function getAdminAllowlist(): string[] {
  const raw = process.env["ADMIN_WALLETS"] ?? "";
  return raw
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
}

export function isAdminWallet(walletAddress: string | undefined | null): boolean {
  if (!walletAddress) return false;
  return getAdminAllowlist().includes(walletAddress.toLowerCase());
}

/**
 * Dev-only auto-admin bypass. Requires BOTH:
 *  - NODE_ENV !== "production"
 *  - explicit opt-in flag DEV_AUTO_ADMIN=true
 * When active, requests are treated as an already-authenticated admin wallet
 * (the first address in ADMIN_WALLETS) without going through SIWE. This never
 * touches the real verify/session code path, and is fully inert unless both
 * conditions hold, so it can never be silently active in production.
 */
export function getDevBypassWallet(): string | undefined {
  if (process.env["NODE_ENV"] === "production") return undefined;
  if (process.env["DEV_AUTO_ADMIN"] !== "true") return undefined;
  const [firstAdmin] = getAdminAllowlist();
  return firstAdmin;
}

/** Resolves the effective wallet for a request: real session, or dev bypass. */
export function getEffectiveWallet(req: Request): string | undefined {
  return req.session.walletAddress ?? getDevBypassWallet();
}

/**
 * Middleware that requires the session wallet to be on the admin allowlist
 * (ADMIN_WALLETS env var, comma-separated addresses). Returns 401 if there's
 * no session, 403 if the wallet is not an admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const wallet = getEffectiveWallet(req);
  if (!wallet) {
    res.status(401).json({ error: "Wallet not authenticated — please sign in" });
    return;
  }
  if (!isAdminWallet(wallet)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * Middleware that requires a verified wallet session.
 * Returns 401 if the session is missing or doesn't match the wallet address
 * expected for the request (e.g. from req.params or req.body).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getEffectiveWallet(req)) {
    res.status(401).json({ error: "Wallet not authenticated — please sign in" });
    return;
  }
  next();
}

/**
 * Middleware that requires the session wallet to match the wallet in the request.
 * Pass the field name of the wallet in req.body (e.g. "walletAddress").
 * Also checks req.params.walletAddress if present.
 */
export function requireWalletOwnership(
  bodyField = "walletAddress",
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = getEffectiveWallet(req);
    if (!session) {
      res.status(401).json({ error: "Wallet not authenticated — please sign in" });
      return;
    }

    const bodyWallet = (req.body?.[bodyField] as string | undefined)?.toLowerCase();
    const paramWallet = (req.params?.walletAddress as string | undefined)?.toLowerCase();
    const targetWallet = bodyWallet ?? paramWallet;

    if (targetWallet && targetWallet !== session) {
      res.status(403).json({ error: "Session wallet does not match request wallet" });
      return;
    }

    next();
  };
}
