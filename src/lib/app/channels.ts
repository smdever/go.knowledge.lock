import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { AppUser } from "./auth";
import { appDb } from "./db";
import { AppError, audit } from "./orgs";
import { appUrl } from "@/lib/mode";

/**
 * Slack and Microsoft Teams notifications through channel webhooks. An owner pastes a webhook link for a
 * channel; we post short notices there with a button back to Knowledge Lock. Webhook links are secrets,
 * so they're stored encrypted and only ever shown as a hint.
 */
export type ChannelKind = "slack" | "teams";
export const CHANNEL_EVENTS = ["signoff_needed", "changes_requested", "locked"] as const;
export type ChannelEvent = (typeof CHANNEL_EVENTS)[number];
export const EVENT_LABEL: Record<ChannelEvent, string> = {
  signoff_needed: "Sign-off needed",
  changes_requested: "Changes requested",
  locked: "Locked",
};
const MAX_CHANNELS = 5;
/** After this many failed posts in a row, a channel is paused until an owner tests it again. */
const PAUSE_AFTER = 10;

export interface ChannelSummary {
  id: string;
  kind: ChannelKind;
  name: string;
  hint: string;
  events: ChannelEvent[];
  createdAt: Date;
  lastOkAt: Date | null;
  lastError: string | null;
  failures: number;
  paused: boolean;
}

// ---------- Encryption of webhook links ----------

function secretKey(): Buffer {
  const seed = process.env.KL_SECRETS_KEY || process.env.KL_AUTHORITY_PRIVATE_KEY;
  if (!seed && process.env.VERCEL) console.warn("[knowledge-lock] set KL_SECRETS_KEY to encrypt webhook links with a stable key");
  return createHash("sha256").update(`kl-channels:${seed || "local-development-only"}`).digest();
}

function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

function unseal(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", secretKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

// ---------- Which links we accept ----------

/** Only real Slack and Microsoft webhook hosts, over HTTPS, so a pasted link can't point us at anything else. */
export function checkWebhook(kind: ChannelKind, raw: unknown): URL {
  const text = typeof raw === "string" ? raw.trim() : "";
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new AppError("Paste the full webhook link, starting with https://");
  }
  const testHost = process.env.NODE_ENV !== "production" ? process.env.KL_WEBHOOK_TEST_HOST : undefined;
  if (testHost && url.host === testHost) return url;
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new AppError("That doesn't look like a webhook link. It should start with https://");
  }
  const host = url.hostname.toLowerCase();
  if (kind === "slack") {
    if (host !== "hooks.slack.com" || !(url.pathname.startsWith("/services/") || url.pathname.startsWith("/triggers/"))) {
      throw new AppError("That isn't a Slack webhook link. It should start with https://hooks.slack.com/");
    }
  } else if (!(host.endsWith(".logic.azure.com") || host.endsWith(".powerplatform.com"))) {
    throw new AppError("That isn't a Teams Workflows webhook link. In Teams, use Workflows › “Post to a channel when a webhook request is received”.");
  }
  return url;
}

const hintFor = (url: URL) => `${url.hostname}/…${url.pathname.slice(-4)}`;

const parseEvents = (raw: unknown): ChannelEvent[] => {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return CHANNEL_EVENTS.filter((e) => list.includes(e));
};

// ---------- Managing channels ----------

async function requireOwner(orgId: string, user: AppUser) {
  const db = await appDb();
  const [m] = await db<{ role: string }[]>`SELECT role FROM kl_members WHERE org_id = ${orgId} AND user_id = ${user.id}`;
  if (m?.role !== "owner") throw new AppError("Only owners can manage Slack and Teams channels.");
}

export async function listChannels(orgId: string): Promise<ChannelSummary[]> {
  const db = await appDb();
  return db<ChannelSummary[]>`
    SELECT id, kind, name, hint, events, created_at AS "createdAt", last_ok_at AS "lastOkAt", last_error AS "lastError",
           failures, (paused_at IS NOT NULL) AS paused
    FROM kl_channels WHERE org_id = ${orgId} AND removed_at IS NULL ORDER BY created_at`;
}

export async function addChannel(
  orgId: string,
  user: AppUser,
  input: { kind?: unknown; name?: unknown; url?: unknown; events?: unknown }
): Promise<ChannelSummary> {
  await requireOwner(orgId, user);
  const kind: ChannelKind = input.kind === "teams" ? "teams" : "slack";
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
  if (!name) throw new AppError("Give the channel a name, such as #delivery-signoffs.");
  const url = checkWebhook(kind, input.url);
  const events = parseEvents(input.events);
  if (!events.length) throw new AppError("Choose at least one thing to post.");
  const db = await appDb();
  const [n] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM kl_channels WHERE org_id = ${orgId} AND removed_at IS NULL`;
  if (n.n >= MAX_CHANNELS) throw new AppError(`You can connect up to ${MAX_CHANNELS} channels. Remove one first.`);
  const id = `ch_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db`INSERT INTO kl_channels (id, org_id, kind, name, url_sealed, hint, events, created_by)
           VALUES (${id}, ${orgId}, ${kind}, ${name}, ${seal(url.toString())}, ${hintFor(url)}, ${events}, ${user.id})`;
  await audit(orgId, user, "channel.added", name, { kind, events });
  return (await listChannels(orgId)).find((c) => c.id === id)!;
}

export async function removeChannel(orgId: string, user: AppUser, id: string): Promise<void> {
  await requireOwner(orgId, user);
  const db = await appDb();
  const [row] = await db<{ name: string; kind: string }[]>`
    UPDATE kl_channels SET removed_at = now() WHERE id = ${id} AND org_id = ${orgId} AND removed_at IS NULL RETURNING name, kind`;
  if (row) await audit(orgId, user, "channel.removed", row.name, { kind: row.kind });
}

/** Sends a test notice and, if it works, un-pauses the channel. */
export async function testChannel(orgId: string, user: AppUser, id: string, orgName: string): Promise<{ ok: boolean; error?: string }> {
  await requireOwner(orgId, user);
  const db = await appDb();
  const [row] = await db<{ id: string; kind: ChannelKind; urlSealed: string }[]>`
    SELECT id, kind, url_sealed AS "urlSealed" FROM kl_channels WHERE id = ${id} AND org_id = ${orgId} AND removed_at IS NULL`;
  if (!row) throw new AppError("That channel isn't connected any more.");
  const result = await deliver(row, {
    orgName,
    headline: "Knowledge Lock is connected",
    lines: [`This channel will get ${orgName}'s Knowledge Lock notices. Sent as a test by an owner.`],
    people: [],
    cta: "Open Knowledge Lock",
    url: `${appUrl()}/app`,
  });
  if (result.ok) await db`UPDATE kl_channels SET paused_at = NULL WHERE id = ${id}`;
  return result;
}

// ---------- Posting ----------

export interface Mentioned {
  name: string;
  email: string;
  slackId?: string | null;
}

export interface Notice {
  orgName: string;
  headline: string;
  lines: string[];
  /** People who need to act. Mentioned in Teams by email, in Slack by member ID when they've added it. */
  people: Mentioned[];
  cta: string;
  url: string;
}

const slackEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function slackPayload(n: Notice) {
  const who = n.people.map((p) => (p.slackId ? `<@${p.slackId}>` : `*${slackEsc(p.name)}*`));
  const text = [`*${slackEsc(n.headline)}*`, ...n.lines.map(slackEsc), ...(who.length ? [`Waiting for: ${who.join(", ")}`] : [])].join("\n");
  return {
    text: `${n.headline}${n.url ? ` ${n.url}` : ""}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      ...(n.url
        ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: n.cta }, url: n.url, style: "primary" }] }]
        : []),
      { type: "context", elements: [{ type: "mrkdwn", text: `Knowledge Lock · ${slackEsc(n.orgName)}` }] },
    ],
  };
}

export function teamsPayload(n: Notice) {
  const mentions = n.people.map((p) => ({ type: "mention", text: `<at>${p.name}</at>`, mentioned: { id: p.email, name: p.name } }));
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: n.headline, weight: "Bolder", size: "Medium", wrap: true },
            ...n.lines.map((l) => ({ type: "TextBlock", text: l, wrap: true })),
            ...(mentions.length ? [{ type: "TextBlock", text: `Waiting for: ${mentions.map((m) => m.text).join(", ")}`, wrap: true }] : []),
            { type: "TextBlock", text: `Knowledge Lock · ${n.orgName}`, isSubtle: true, size: "Small", wrap: true },
          ],
          actions: n.url ? [{ type: "Action.OpenUrl", title: n.cta, url: n.url }] : [],
          msteams: { width: "Full", ...(mentions.length ? { entities: mentions } : {}) },
        },
      },
    ],
  };
}

async function deliver(row: { id: string; kind: ChannelKind; urlSealed: string }, n: Notice): Promise<{ ok: boolean; error?: string }> {
  const db = await appDb();
  let error: string | undefined;
  try {
    const url = unseal(row.urlSealed);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row.kind === "slack" ? slackPayload(n) : teamsPayload(n)),
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 120);
      error =
        res.status === 404 || res.status === 410 || /no_service|channel_not_found|invalid_token/.test(body)
          ? "The webhook link no longer works. It may have been deleted in Slack or Teams."
          : res.status === 403 || /action_prohibited|posting_to_general_channel_denied/.test(body)
            ? "Slack or Teams refused the post. Check the webhook's permissions."
            : `Slack or Teams replied with an error (${res.status}).`;
    }
  } catch (err) {
    error = (err as Error).name === "TimeoutError" ? "Slack or Teams didn't respond in time." : "We couldn't reach Slack or Teams.";
    console.warn("[knowledge-lock] channel post failed", row.id, (err as Error).message);
  }
  if (error) {
    await db`UPDATE kl_channels SET failures = failures + 1, last_error = ${error}, last_error_at = now(),
               paused_at = CASE WHEN failures + 1 >= ${PAUSE_AFTER} THEN coalesce(paused_at, now()) ELSE paused_at END
             WHERE id = ${row.id}`;
    return { ok: false, error };
  }
  await db`UPDATE kl_channels SET failures = 0, last_error = NULL, last_ok_at = now() WHERE id = ${row.id}`;
  return { ok: true };
}

/** Posts a notice to every active channel in the organisation that wants this event. Never throws. */
export async function postToChannels(orgId: string, event: ChannelEvent, notice: Notice): Promise<void> {
  try {
    const db = await appDb();
    const rows = await db<{ id: string; kind: ChannelKind; urlSealed: string }[]>`
      SELECT id, kind, url_sealed AS "urlSealed" FROM kl_channels
      WHERE org_id = ${orgId} AND removed_at IS NULL AND paused_at IS NULL AND ${event} = ANY(events)`;
    if (!rows.length) return;
    // People's Slack member IDs, for real @mentions.
    const emails = notice.people.map((p) => p.email);
    const ids = emails.length
      ? await db<{ email: string; slackId: string }[]>`
          SELECT email, slack_member_id AS "slackId" FROM kl_profiles WHERE email = ANY(${emails}) AND slack_member_id IS NOT NULL`
      : [];
    const people = notice.people.map((p) => ({ ...p, slackId: ids.find((i) => i.email === p.email)?.slackId ?? null }));
    await Promise.allSettled(rows.map((r) => deliver(r, { ...notice, people })));
  } catch (err) {
    console.error("[knowledge-lock] channel notices failed", err);
  }
}

/** A Slack member ID looks like U0123ABCD (or W… on Enterprise Grid). Empty clears it. */
export function checkSlackId(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!v) return null;
  if (!/^[UW][A-Z0-9]{6,20}$/.test(v)) throw new AppError("A Slack member ID looks like U0123ABCD. In Slack, open your profile, then ⋮ › Copy member ID.");
  return v;
}
