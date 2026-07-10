import { Router } from "express";
import { verifyMessage } from "ethers";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { db, authNoncesTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { isAdminWallet, getDevBypassWallet } from "../middleware/requireAuth";

const router: Router = Router();

// Nonces are persisted in Postgres (auth_nonces table) so sign-in survives
// server restarts and works across horizontally-scaled instances.
// TTL of 5 minutes per challenge.
const NONCE_TTL_MS = 5 * 60 * 1000;

type ChainFamily = "evm" | "solana";

async function pruneExpiredNonces(): Promise<void> {
  await db.delete(authNoncesTable).where(lt(authNoncesTable.expiresAt, new Date()));
}

function isEvmAddress(address: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(address);
}

// Base58, 32-44 chars — standard Solana public key encoding (32-byte ed25519 key).
function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
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

function buildSolanaMessage(params: { domain: string; address: string; nonce: string; issuedAt: string }): string {
  return [
    `${params.domain} wants you to sign in with your Solana account:`,
    params.address,
    "",
    "Sign in to Wegen Trait Store",
    "",
    `URI: https://${params.domain}`,
    "Version: 1",
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ].join("\n");
}

// GET /api/auth/nonce?address=0x...&chainId=1&chain=evm|solana
router.get("/auth/nonce", async (req, res): Promise<void> => {
  await pruneExpiredNonces();
  const chain: ChainFamily = req.query.chain === "solana" ? "solana" : "evm";
  const chainId = (req.query.chainId as string) || "1";
  const rawAddress = req.query.address as string;

  let address: string | undefined;
  if (chain === "solana") {
    // Solana addresses are base58 and case-sensitive — do not lowercase.
    address = rawAddress;
    if (!address || !isSolanaAddress(address)) {
      res.status(400).json({ error: "Invalid Solana address" });
      return;
    }
  } else {
    address = rawAddress?.toLowerCase();
    if (!address || !isEvmAddress(address)) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
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

  const message =
    chain === "solana"
      ? buildSolanaMessage({ domain, address, nonce, issuedAt })
      : buildSiweMessage({ domain, address, nonce, issuedAt, chainId });
  res.json({ nonce, message });
});

// POST /api/auth/verify  { address, message, signature, chain? }
router.post("/auth/verify", async (req, res): Promise<void> => {
  const { address: rawAddress, message, signature, chain: rawChain } = req.body as {
    address: string;
    message: string;
    signature: string;
    chain?: string;
  };
  const chain: ChainFamily = rawChain === "solana" ? "solana" : "evm";
  const address = chain === "solana" ? rawAddress : rawAddress?.toLowerCase();

  if (!address || !message || !signature) {
    res.status(400).json({ error: "address, message, and signature are required" });
    return;
  }

  if (chain === "solana" && !isSolanaAddress(address)) {
    res.status(400).json({ error: "Invalid Solana address" });
    return;
  }
  if (chain === "evm" && !isEvmAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
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

  if (chain === "solana") {
    try {
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(message);
      const publicKeyBytes = bs58.decode(address);
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
      if (!isValid) {
        res.status(401).json({ error: "Signature verification failed" });
        return;
      }
    } catch {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  } else {
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
  }

  // Consume nonce (prevent replay attacks)
  await db.delete(authNoncesTable).where(eq(authNoncesTable.address, address));

  req.session.walletAddress = address;
  req.session.walletChain = chain;
  req.session.save((err) => {
    if (err) {
      req.log?.error({ err }, "Session save error");
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.json({ success: true, walletAddress: address, walletChain: chain });
  });
});

// GET /api/auth/session — check current session
router.get("/auth/session", (req, res): void => {
  if (req.session.walletAddress) {
    res.json({
      walletAddress: req.session.walletAddress,
      walletChain: req.session.walletChain ?? "evm",
      isAdmin: isAdminWallet(req.session.walletAddress),
      isDevBypass: false,
    });
    return;
  }

  // Dev-only auto-admin bypass (see getDevBypassWallet) — never active in
  // production, and never touches the real SIWE session above.
  const bypassWallet = getDevBypassWallet();
  if (bypassWallet) {
    res.json({
      walletAddress: bypassWallet,
      walletChain: "evm",
      isAdmin: isAdminWallet(bypassWallet),
      isDevBypass: true,
    });
    return;
  }

  res.status(401).json({ walletAddress: null, isAdmin: false });
});

// POST /api/auth/disconnect
router.post("/auth/disconnect", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
