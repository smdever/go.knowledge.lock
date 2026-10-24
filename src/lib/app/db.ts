import { databaseUrl, ensureSchema, markSchema, schemaIsCurrent, sql } from "@/lib/demo/store/postgres";

/** Bump when the statements below change (see schemaIsCurrent). */
const APP_SCHEMA_VERSION = 9;

const g = globalThis as unknown as { __klAppSchema?: Promise<void> };

/** The product's own tables. They live in the product's database, never the demo's. */
export async function appDb() {
  if (!databaseUrl()) throw new Error("The product needs DATABASE_URL (or POSTGRES_URL).");
  if (!g.__klAppSchema) {
    const db = sql();
    g.__klAppSchema = (async () => {
      // Locks, supersessions and usage counters use the same append-only tables as the demo.
      await ensureSchema();
      if (await schemaIsCurrent(db, "app", APP_SCHEMA_VERSION)) return;
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
      await db`
        CREATE TABLE IF NOT EXISTS kl_api_keys (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES kl_organisations(id),
          name text NOT NULL,
          prefix text NOT NULL,
          key_hash text NOT NULL UNIQUE,
          created_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          last_used_at timestamptz,
          revoked_at timestamptz
        )`;
      // Personal signing keys: each person's passkeys. Only public keys are stored.
      await db`
        CREATE TABLE IF NOT EXISTS kl_passkeys (
          id text PRIMARY KEY,
          user_id text NOT NULL,
          public_key bytea NOT NULL,
          jwk jsonb NOT NULL,
          alg integer NOT NULL,
          counter bigint NOT NULL DEFAULT 0,
          transports text[] NOT NULL DEFAULT '{}',
          name text NOT NULL,
          synced boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          last_used_at timestamptz,
          removed_at timestamptz
        )`;
      await db`CREATE INDEX IF NOT EXISTS kl_passkeys_user ON kl_passkeys (user_id)`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_passkey_challenges (
          user_id text PRIMARY KEY,
          challenge text NOT NULL,
          expires_at timestamptz NOT NULL
        )`;
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS require_passkeys boolean NOT NULL DEFAULT false`;
      // Slack and Teams channel webhooks. The link is encrypted (see channels.ts).
      await db`
        CREATE TABLE IF NOT EXISTS kl_channels (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES kl_organisations(id),
          kind text NOT NULL CHECK (kind IN ('slack', 'teams')),
          name text NOT NULL,
          url_sealed text NOT NULL,
          hint text NOT NULL,
          events text[] NOT NULL,
          created_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          last_ok_at timestamptz,
          last_error text,
          last_error_at timestamptz,
          failures integer NOT NULL DEFAULT 0,
          paused_at timestamptz,
          removed_at timestamptz
        )`;
      await db`CREATE INDEX IF NOT EXISTS kl_channels_org ON kl_channels (org_id)`;
      await db`ALTER TABLE kl_profiles ADD COLUMN IF NOT EXISTS slack_member_id text`;
      // Channels that already get "Locked" notices also get "Retired" ones.
      await db`UPDATE kl_channels SET events = array_append(events, 'retired') WHERE 'locked' = ANY(events) AND NOT ('retired' = ANY(events))`;
      // Requests for access from the sign-in page.
      await db`
        CREATE TABLE IF NOT EXISTS kl_access_requests (
          id text PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL,
          company text NOT NULL,
          title text NOT NULL DEFAULT '',
          message text NOT NULL DEFAULT '',
          ip_hash text,
          status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
          created_at timestamptz NOT NULL DEFAULT now(),
          handled_by text,
          handled_at timestamptz,
          org_id text
        )`;
      await db`CREATE INDEX IF NOT EXISTS kl_access_requests_status ON kl_access_requests (status, created_at DESC)`;
      // Jira Cloud: one connection per organisation (API token and webhook secret encrypted), and linked issues.
      await db`
        CREATE TABLE IF NOT EXISTS kl_jira (
          org_id text PRIMARY KEY REFERENCES kl_organisations(id),
          site text NOT NULL,
          email text NOT NULL,
          token_sealed text NOT NULL,
          secret_sealed text NOT NULL,
          account_name text NOT NULL DEFAULT '',
          auto_check boolean NOT NULL DEFAULT true,
          connected_by text NOT NULL,
          connected_at timestamptz NOT NULL DEFAULT now(),
          last_webhook_at timestamptz,
          last_error text
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS kl_jira_links (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES kl_organisations(id),
          issue_id text NOT NULL,
          issue_key text NOT NULL,
          issue_summary text NOT NULL DEFAULT '',
          lock_id text NOT NULL,
          record_id text NOT NULL,
          claim_id text,
          status text NOT NULL,
          result_summary text NOT NULL DEFAULT '',
          findings jsonb NOT NULL DEFAULT '[]'::jsonb,
          result_key text,
          text_hash text,
          checked_at timestamptz,
          checked_by text,
          auto boolean NOT NULL DEFAULT false,
          linked_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          unlinked_at timestamptz
        )`;
      await db`CREATE INDEX IF NOT EXISTS kl_jira_links_lock ON kl_jira_links (org_id, lock_id)`;
      await db`CREATE UNIQUE INDEX IF NOT EXISTS kl_jira_links_issue ON kl_jira_links (org_id, issue_id) WHERE unlinked_at IS NULL`;
      // Retired locks: an owner says a locked record is no longer the source of truth. The lock itself never changes.
      await db`
        CREATE TABLE IF NOT EXISTS kl_retirements (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES kl_organisations(id),
          lock_id text NOT NULL,
          record_id text NOT NULL,
          reason text NOT NULL,
          retired_by text NOT NULL,
          retired_by_name text NOT NULL,
          retired_at timestamptz NOT NULL DEFAULT now(),
          restored_by text,
          restored_by_name text,
          restored_at timestamptz
        )`;
      await db`CREATE UNIQUE INDEX IF NOT EXISTS kl_retirements_current ON kl_retirements (lock_id) WHERE restored_at IS NULL`;
      // Getting started: when an owner hid the checklist, and when the one reminder email went.
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz`;
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS onboarding_reminded_at timestamptz`;
      // Closing an organisation: who asked, and when everything in it will be deleted.
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS closing_at timestamptz`;
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS closing_by text`;
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS closing_by_name text`;
      await db`ALTER TABLE kl_organisations ADD COLUMN IF NOT EXISTS delete_after timestamptz`;
      await db`CREATE INDEX IF NOT EXISTS kl_members_user ON kl_members (user_id)`;
      await db`CREATE INDEX IF NOT EXISTS kl_invites_org ON kl_invites (org_id)`;
      await db`CREATE INDEX IF NOT EXISTS kl_audit_org ON kl_audit (org_id, at)`;
      for (const table of ["kl_organisations", "kl_profiles", "kl_members", "kl_invites", "kl_audit", "kl_app_records", "kl_api_keys", "kl_passkeys", "kl_passkey_challenges", "kl_channels", "kl_access_requests", "kl_jira", "kl_jira_links", "kl_retirements"]) {
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
      await markSchema(db, "app", APP_SCHEMA_VERSION);
    })().catch((err) => {
      g.__klAppSchema = undefined;
      throw err;
    });
  }
  await g.__klAppSchema;
  return sql();
}
