import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored at rest (the per-user AI API keys).
 * Server-only — never import this into client code, and never expose AI_KEY_SECRET
 * with a NEXT_PUBLIC_ prefix. The key is derived from AI_KEY_SECRET via scrypt.
 *
 * Ciphertext format: `v1:<iv b64>:<authTag b64>:<ciphertext b64>`.
 * Rotating AI_KEY_SECRET invalidates all stored keys (they can't be decrypted),
 * so users would re-enter theirs — expected for encryption-at-rest.
 */

// Trim, strip surrounding quotes, and keep only the first token so a paste
// artifact on a deploy host can't make the same logical secret derive a
// different key than local/dev. (Secrets containing spaces aren't supported.)
const SECRET =
  process.env.AI_KEY_SECRET?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0] || undefined;

export const aiKeySecretConfigured = (): boolean => Boolean(SECRET && SECRET.length >= 16);

function derivedKey(): Buffer {
  if (!SECRET) throw new Error("AI_KEY_SECRET is not set");
  // Static salt is fine here: the secret is high-entropy and server-held, and a
  // per-value salt would need to be stored alongside each ciphertext anyway.
  return crypto.scryptSync(SECRET, "lens-ai-key-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(enc: string): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Malformed ciphertext");
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
