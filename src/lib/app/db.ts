import { databaseUrl, ensureSchema, sql } from "@/lib/demo/store/postgres";

const g = globalThis as unknown as { __klAppSchema?: Promise<void> };

/** The product's own tables. They live in the product's database, never the demo's. */
export async function appDb() {
  if (!databaseUrl()) throw new Error("The product needs DATABASE_URL (or POSTGRES_URL).");
  if (!g.__klAppSchema) {
    const db = sql();
    g.__klAppSchema = (async () => {
      // Locks, supersessions and usage counters use the same append-only tables as the demo.
      await ensureSchema();
      await db`
        CREATE TABLE IF NOT EXISTS kl_organisations (
          id text PRIMARY KEY,
          name text NOT NULL,
          policy_lock_id text,
          created_at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_profiles (
          user_id text PRIMARY KEY,
          email text NOT NULL,
          name text NOT NULL,
          title text NOT NULL DEFAULT '',
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_members (
          org_id text NOT NULL REFERENCES kl_organisations(id),
          user_id text NOT NULL,
          email text NOT NULL,
          role text NOT NULL CHECK (role IN ('owner', 'signer', 'viewer')),
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (org_id, user_id)
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_invites (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES kl_organisations(id),
          email text NOT NULL,
          role text NOT NULL CHECK (role IN ('owner', 'signer', 'viewer')),
          token_hash text NOT NULL UNIQUE,
          invited_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL,
          accepted_at timestamptz,
          revoked_at timestamptz
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_audit (
          id bigserial PRIMARY KEY,
          org_id text,
          actor_id text,
          actor_email text,
          action text NOT NULL,
          target text,
          detail jsonb,
          at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_app_records (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES kl_organisations(id),
          kind text NOT NULL CHECK (kind IN ('requirements', 'policy')),
          status text NOT NULL CHECK (status IN ('draft', 'locked')),
          created_by text NOT NULL,
          lock_id text,
          data jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      await db`CREATE INDEX IF NOT EXISTS kl_app_records_org ON kl_app_records (org_id, updated_at DESC)`;
      await db`CREATE INDEX IF NOT EXISTS kl_members_user ON kl_members (user_id)`;
      await db`CREATE INDEX IF NOT EXISTS kl_invites_org ON kl_invites (org_id)`;
      await db`CREATE INDEX IF NOT EXISTS kl_audit_org ON kl_audit (org_id, at)`;
      for (const table of ["kl_organisations", "kl_profiles", "kl_members", "kl_invites", "kl_audit", "kl_app_records"]) {
        await db.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      }
      // The audit log is append-only, like locks.
      await db`
        CREATE OR REPLACE FUNCTION kl_forbid_change() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Knowledge Lock records are append-only (% on %)', TG_OP, TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql`;
      await db`DROP TRIGGER IF EXISTS kl_audit_append_only ON kl_audit`;
      await db`
        CREATE TRIGGER kl_audit_append_only BEFORE UPDATE OR DELETE ON kl_audit
        FOR EACH ROW EXECUTE FUNCTION kl_forbid_change()`;
    })().catch((err) => {
      g.__klAppSchema = undefined;
      throw err;
    });
  }
  await g.__klAppSchema;
  return sql();
}
