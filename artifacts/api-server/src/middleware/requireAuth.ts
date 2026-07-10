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
 * Middleware that requires the session wallet to be on the admin allowlist
 * (ADMIN_WALLETS env var, comma-separated addresses). Returns 401 if there's
 * no session, 403 if the wallet is not an admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const wallet = req.session.walletAddress;
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
  if (!req.session.walletAddress) {
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
    const session = req.session.walletAddress;
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
