import { Router } from "express";
import { getAddress, verifyMessage } from "ethers";
import crypto from "crypto";

const router: Router = Router();

// In-memory nonce store: address → { nonce, expires }
// TTL of 5 minutes per challenge
const nonces = new Map<string, { nonce: string; expires: number }>();

function pruneExpiredNonces() {
  const now = Date.now();
  for (const [addr, entry] of nonces.entries()) {
    if (entry.expires < now) nonces.delete(addr);
  }
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
router.get("/auth/nonce", (req, res): void => {
  pruneExpiredNonces();
  const rawAddress = req.query.address as string;
  const chainId = (req.query.chainId as string) || "1";
  if (!rawAddress || !/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  let checksumAddress: string;
  try {
    checksumAddress = getAddress(rawAddress);
  } catch {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const addressKey = checksumAddress.toLowerCase();

  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const domain = req.hostname || "localhost";

  nonces.set(addressKey, { nonce, expires: Date.now() + 5 * 60 * 1000 });

  const message = buildSiweMessage({
    domain,
    address: checksumAddress,
    nonce,
    issuedAt,
    chainId,
  });
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

  const stored = nonces.get(address);
  if (!stored || stored.expires < Date.now()) {
    res.status(401).json({ error: "Nonce expired or not found — please reconnect" });
    return;
  }

  // Nonces must appear in the signed message
  if (!message.includes(stored.nonce) || !message.toLowerCase().includes(address)) {
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
  nonces.delete(address);

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
