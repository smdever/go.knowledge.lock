import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AppUser } from "./auth";
import { appDb } from "./db";
import { AppError, assertOrgOpen, audit } from "./orgs";

/**
 * API keys let an organisation's own systems and AI agents read its locked records.
 * The key is shown once when it's created; only its SHA-256 hash is stored.
 */
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const MAX_ACTIVE_KEYS = 10;

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  createdByName: string | null;
}

async function requireOwner(orgId: string, user: AppUser) {
  const db = await appDb();
  const [m] = await db<{ role: string }[]>`SELECT role FROM kl_members WHERE org_id = ${orgId} AND user_id = ${user.id}`;
  if (m?.role !== "owner") throw new AppError("Only owners can manage API keys.");
}

export async function listApiKeys(orgId: string): Promise<ApiKeySummary[]> {
  const db = await appDb();
  return db<ApiKeySummary[]>`
    SELECT k.id, k.name, k.prefix, k.created_at AS "createdAt", k.last_used_at AS "lastUsedAt", p.name AS "createdByName"
    FROM kl_api_keys k LEFT JOIN kl_profiles p ON p.user_id = k.created_by
    WHERE k.org_id = ${orgId} AND k.revoked_at IS NULL ORDER BY k.created_at DESC`;
}

export async function createApiKey(orgId: string, user: AppUser, nameRaw: unknown): Promise<{ key: string; name: string }> {
  await requireOwner(orgId, user);
  await assertOrgOpen(orgId);
  const name = typeof nameRaw === "string" ? nameRaw.trim().slice(0, 60) : "";
  if (!name) throw new AppError("Give the key a name, such as the agent or system that will use it.");
  const db = await appDb();
  const [count] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM kl_api_keys WHERE org_id = ${orgId} AND revoked_at IS NULL`;
  if (count.n >= MAX_ACTIVE_KEYS) throw new AppError(`You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  const key = `kl_live_${randomBytes(24).toString("base64url")}`;
  const id = `key_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db`INSERT INTO kl_api_keys (id, org_id, name, prefix, key_hash, created_by)
           VALUES (${id}, ${orgId}, ${name}, ${key.slice(0, 12)}, ${hash(key)}, ${user.id})`;
  await audit(orgId, user, "api_key.created", name);
  return { key, name };
}

export async function revokeApiKey(orgId: string, user: AppUser, keyId: string): Promise<void> {
  await requireOwner(orgId, user);
  const db = await appDb();
  const rows = await db<{ name: string }[]>`UPDATE kl_api_keys SET revoked_at = now()
    WHERE id = ${keyId} AND org_id = ${orgId} AND revoked_at IS NULL RETURNING name`;
  if (rows[0]) await audit(orgId, user, "api_key.revoked", rows[0].name);
}

/** Looks up an active key from an `Authorization: Bearer kl_live_…` header. */
export async function keyFromRequest(request: Request): Promise<{ keyId: string; orgId: string; name: string } | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(kl_live_[A-Za-z0-9_-]{20,})$/.exec(header.trim());
  if (!match) return null;
  const db = await appDb();
  const [row] = await db<{ keyId: string; orgId: string; name: string; lastUsedAt: Date | null }[]>`
    SELECT id AS "keyId", org_id AS "orgId", name, last_used_at AS "lastUsedAt"
    FROM kl_api_keys WHERE key_hash = ${hash(match[1])} AND revoked_at IS NULL`;
  if (!row) return null;
  // Record use at most once a minute, to keep requests cheap.
  if (!row.lastUsedAt || Date.now() - new Date(row.lastUsedAt).getTime() > 60_000) {
    await db`UPDATE kl_api_keys SET last_used_at = now() WHERE id = ${row.keyId}`;
  }
  return { keyId: row.keyId, orgId: row.orgId, name: row.name };
}
