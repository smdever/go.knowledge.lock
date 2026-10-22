import postgres from "postgres";
import type { KnowledgeLockBlock } from "@/lib/protocol";
import type { DemoRecord } from "../types";
import type { Store } from "./types";

/** DATABASE_URL, or POSTGRES_URL as set by the Vercel Supabase/Neon integrations. */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

const g = globalThis as unknown as { __klSql?: postgres.Sql; __klSchema?: Promise<void> };

function sql(): postgres.Sql {
  if (!g.__klSql) {
    g.__klSql = postgres(databaseUrl() as string, {
      max: 3,
      idle_timeout: 20,
      prepare: false, // works with transaction-mode poolers (Neon, Supabase)
    });
  }
  return g.__klSql;
}

/**
 * Creates tables on first use. The locks and supersessions tables are append-only:
 * a trigger rejects any UPDATE or DELETE, so a stored lock cannot be changed in place.
 */
async function ensureSchema(): Promise<void> {
  if (!g.__klSchema) {
    const db = sql();
    g.__klSchema = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS kl_records (
          id text PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_locks (
          lock_id text PRIMARY KEY,
          record_id text,
          block jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_supersessions (
          lock_id text PRIMARY KEY,
          superseded_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_usage (
          key text PRIMARY KEY,
          count integer NOT NULL DEFAULT 0
        )`;
      await db`ALTER TABLE kl_usage ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      // Row-level security with no policies: hosts that expose tables over an HTTP API
      // (e.g. Supabase) deny all access through it. The app's own connection owns the
      // tables and is unaffected.
      for (const table of ["kl_records", "kl_locks", "kl_supersessions", "kl_usage"]) {
        await db.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      }
      await db`
        CREATE OR REPLACE FUNCTION kl_forbid_change() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Knowledge Lock records are append-only (% on %)', TG_OP, TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql`;
      await db`DROP TRIGGER IF EXISTS kl_locks_append_only ON kl_locks`;
      await db`
        CREATE TRIGGER kl_locks_append_only BEFORE UPDATE OR DELETE ON kl_locks
        FOR EACH ROW EXECUTE FUNCTION kl_forbid_change()`;
      await db`DROP TRIGGER IF EXISTS kl_supersessions_append_only ON kl_supersessions`;
      await db`
        CREATE TRIGGER kl_supersessions_append_only BEFORE UPDATE OR DELETE ON kl_supersessions
        FOR EACH ROW EXECUTE FUNCTION kl_forbid_change()`;
    })().catch((err) => {
      g.__klSchema = undefined;
      throw err;
    });
  }
  return g.__klSchema;
}

export const postgresStore: Store = {
  async getRecord(id) {
    await ensureSchema();
    const rows = await sql()<{ data: DemoRecord }[]>`SELECT data FROM kl_records WHERE id = ${id}`;
    return rows[0]?.data ?? null;
  },
  async saveRecord(record) {
    await ensureSchema();
    const data = sql().json(record as unknown as postgres.JSONValue);
    await sql()`
      INSERT INTO kl_records (id, data, updated_at) VALUES (${record.id}, ${data}, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  },
  async insertLock(block, recordId) {
    await ensureSchema();
    const data = sql().json(block as unknown as postgres.JSONValue);
    await sql()`INSERT INTO kl_locks (lock_id, record_id, block) VALUES (${block.lockId}, ${recordId}, ${data})`;
  },
  async getLock(lockId) {
    await ensureSchema();
    const rows = await sql()<{ block: KnowledgeLockBlock }[]>`SELECT block FROM kl_locks WHERE lock_id = ${lockId}`;
    return rows[0]?.block ?? null;
  },
  async insertSupersession(lockId, supersededBy) {
    await ensureSchema();
    await sql()`INSERT INTO kl_supersessions (lock_id, superseded_by) VALUES (${lockId}, ${supersededBy})`;
  },
  async getSupersededBy(lockId) {
    await ensureSchema();
    const rows = await sql()<{ superseded_by: string }[]>`
      SELECT superseded_by FROM kl_supersessions WHERE lock_id = ${lockId}`;
    return rows[0]?.superseded_by ?? null;
  },
  async incrementUsage(key, amount) {
    await ensureSchema();
    const rows = await sql()<{ count: number }[]>`
      INSERT INTO kl_usage (key, count, updated_at) VALUES (${key}, ${amount}, now())
      ON CONFLICT (key) DO UPDATE SET count = kl_usage.count + ${amount}, updated_at = now()
      RETURNING count`;
    // Usage counters are only needed for rate limits: drop anything older than 48 hours.
    if (Math.random() < 0.05) await sql()`DELETE FROM kl_usage WHERE updated_at < now() - interval '48 hours'`;
    return rows[0].count;
  },
};
