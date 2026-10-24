import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption at rest for secrets we have to keep (webhook links, Jira API tokens). AES-256-GCM, keyed from
 * KL_SECRETS_KEY (or, failing that, the authority key). Changing the key means reconnecting integrations.
 */
function secretKey(): Buffer {
  const seed = process.env.KL_SECRETS_KEY || process.env.KL_AUTHORITY_PRIVATE_KEY;
  if (!seed && process.env.VERCEL) console.warn("[knowledge-lock] set KL_SECRETS_KEY to encrypt integration secrets with a stable key");
  // The label stays "kl-channels" so links saved before this file existed still open.
  return createHash("sha256").update(`kl-channels:${seed || "local-development-only"}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", secretKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
