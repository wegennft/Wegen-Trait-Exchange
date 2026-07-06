import { Router } from "express";
import { verifyMessage } from "ethers";
import crypto from "crypto";
import { db, authNoncesTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const router: Router = Router();

// Nonces are persisted in Postgres (auth_nonces table) so sign-in survives
// server restarts and works across horizontally-scaled instances.
// TTL of 5 minutes per challenge.
const NONCE_TTL_MS = 5 * 60 * 1000;

async function pruneExpiredNonces(): Promise<void> {
  await db.delete(authNoncesTable).where(lt(authNoncesTable.expiresAt, new Date()));
}

function buildSiweMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
  chainId: string;
}): string {
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to Wegen Trait Store",
    "",
    `URI: https://${params.domain}`,
    "Version: 1",
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ].join("\n");
}

// GET /api/auth/nonce?address=0x...&chainId=1
router.get("/auth/nonce", async (req, res): Promise<void> => {
  await pruneExpiredNonces();
  const address = (req.query.address as string)?.toLowerCase();
  const chainId = (req.query.chainId as string) || "1";
  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const domain = req.hostname || "localhost";
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  await db
    .insert(authNoncesTable)
    .values({ address, nonce, expiresAt })
    .onConflictDoUpdate({
      target: authNoncesTable.address,
      set: { nonce, expiresAt },
    });

  const message = buildSiweMessage({ domain, address, nonce, issuedAt, chainId });
  res.json({ nonce, message });
});

// POST /api/auth/verify  { address, message, signature }
router.post("/auth/verify", async (req, res): Promise<void> => {
  const { address: rawAddress, message, signature } = req.body as {
    address: string;
    message: string;
    signature: string;
  };
  const address = rawAddress?.toLowerCase();

  if (!address || !message || !signature) {
    res.status(400).json({ error: "address, message, and signature are required" });
    return;
  }

  const [stored] = await db
    .select()
    .from(authNoncesTable)
    .where(eq(authNoncesTable.address, address));
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    res.status(401).json({ error: "Nonce expired or not found — please reconnect" });
    return;
  }

  // Nonces must appear in the signed message
  if (!message.includes(stored.nonce) || !message.includes(address)) {
    res.status(401).json({ error: "Message does not match issued nonce" });
    return;
  }

  try {
    const recovered = (await verifyMessage(message, signature)).toLowerCase();
    if (recovered !== address) {
      res.status(401).json({ error: "Signature verification failed" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Consume nonce (prevent replay attacks)
  await db.delete(authNoncesTable).where(eq(authNoncesTable.address, address));

  req.session.walletAddress = address;
  req.session.save((err) => {
    if (err) {
      req.log?.error({ err }, "Session save error");
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.json({ success: true, walletAddress: address });
  });
});

// GET /api/auth/session — check current session
router.get("/auth/session", (req, res): void => {
  if (req.session.walletAddress) {
    res.json({ walletAddress: req.session.walletAddress });
  } else {
    res.status(401).json({ walletAddress: null });
  }
});

// POST /api/auth/disconnect
router.post("/auth/disconnect", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
