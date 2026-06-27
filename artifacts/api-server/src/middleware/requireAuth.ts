import type { Request, Response, NextFunction } from "express";

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
