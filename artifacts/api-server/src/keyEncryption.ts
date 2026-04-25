import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT = "wegen-update-authority-key-v1";

function getDerivedKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — cannot encrypt/decrypt update authority key.");
  }
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypts a plaintext private key for storage.
 * Returns a colon-separated string: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encryptAuthorityKey(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a stored ciphertext back to the plaintext private key.
 * Only call this server-side when the key is actually needed for an NFT operation.
 */
export function decryptAuthorityKey(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format.");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Returns true if SESSION_SECRET is configured and the stored ciphertext
 * can be successfully decrypted (integrity check without exposing the value).
 */
export function verifyStoredKey(stored: string): boolean {
  try {
    const result = decryptAuthorityKey(stored);
    return result.length > 0;
  } catch {
    return false;
  }
}
