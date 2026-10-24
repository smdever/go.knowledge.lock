import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DemoError } from "@/lib/demo/service";
import { postgresStore } from "@/lib/demo/store/postgres";
import { appUrl } from "@/lib/mode";
import type { AppUser } from "./auth";
import { appDb } from "./db";
import { AppError, audit } from "./orgs";
import { checkOrgDrift, currentRetirement, memberRole, orgLock, retiredFor, retiredMessage, type Retirement } from "./records";
import { seal, unseal } from "./secrets";

/**
 * Jira Cloud, connected per organisation with a service account's API token.
 *
 * - Check an issue against a locked record, and comment the findings on the issue.
 * - Linked issues get a "Knowledge Lock" web link, and are re-checked when their summary or description
 *   changes (signed Jira webhook). Automatic checks only comment when the result changes.
 * - Create one Jira issue per requirement from a locked record.
 * - When a record gets a new version, its linked issues move to it.
 * - When an owner retires a record, its linked issues get a comment and stop being checked automatically.
 */

// ---------- Connection ----------

export interface JiraConnection {
  orgId: string;
  site: string;
  email: string;
  token: string;
  webhookSecret: string;
  accountName: string;
  autoCheck: boolean;
}

export interface JiraStatus {
  connected: boolean;
  site?: string;
  email?: string;
  accountName?: string;
  autoCheck?: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  lastWebhookAt?: Date | null;
  lastError?: string | null;
}

interface ConnRow {
  site: string;
  email: string;
  tokenSealed: string;
  secretSealed: string;
  accountName: string;
  autoCheck: boolean;
  lastWebhookAt: Date | null;
  lastError: string | null;
}

async function connRow(orgId: string): Promise<ConnRow | null> {
  const db = await appDb();
  const [r] = await db<ConnRow[]>`
    SELECT site, email, token_sealed AS "tokenSealed", secret_sealed AS "secretSealed", account_name AS "accountName",
           auto_check AS "autoCheck", last_webhook_at AS "lastWebhookAt", last_error AS "lastError"
    FROM kl_jira WHERE org_id = ${orgId}`;
  return r ?? null;
}

export async function getConnection(orgId: string): Promise<JiraConnection | null> {
  const r = await connRow(orgId);
  if (!r) return null;
  return { orgId, site: r.site, email: r.email, token: unseal(r.tokenSealed), webhookSecret: unseal(r.secretSealed), accountName: r.accountName, autoCheck: r.autoCheck };
}

export const webhookUrlFor = (orgId: string) => `${appUrl()}/api/jira/webhook/${orgId}`;

/** For owners: everything needed to set up the webhook in Jira. */
export async function jiraStatus(orgId: string, includeSecret: boolean): Promise<JiraStatus> {
  const r = await connRow(orgId);
  if (!r) return { connected: false };
  return {
    connected: true,
    site: r.site,
    email: r.email,
    accountName: r.accountName,
    autoCheck: r.autoCheck,
    webhookUrl: webhookUrlFor(orgId),
    webhookSecret: includeSecret ? unseal(r.secretSealed) : undefined,
    lastWebhookAt: r.lastWebhookAt,
    lastError: r.lastError,
  };
}

/** Only Jira Cloud sites, over HTTPS, so a pasted address can't point us anywhere else. */
export function checkSite(raw: unknown): string {
  let text = typeof raw === "string" ? raw.trim() : "";
  if (text && !/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new AppError("Enter your Jira site, like yourcompany.atlassian.net.");
  }
  const testHost = process.env.NODE_ENV !== "production" ? process.env.KL_JIRA_TEST_HOST : undefined;
  if (testHost && url.host === testHost) return `${url.protocol}//${url.host}`;
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !/^[a-z0-9][a-z0-9-]*\.atlassian\.net$/.test(host) || url.username || url.password || url.port) {
    throw new AppError("Enter your Jira Cloud site, like yourcompany.atlassian.net.");
  }
  return `https://${host}`;
}

async function requireOwner(orgId: string, user: AppUser) {
  if ((await memberRole(orgId, user.id)) !== "owner") throw new AppError("Only owners can connect Jira.");
}

async function requireEditor(orgId: string, user: AppUser) {
  const role = await memberRole(orgId, user.id);
  if (role !== "owner" && role !== "signer") throw new DemoError("Only owners and signers can do that.", 403);
}

export async function connectJira(orgId: string, user: AppUser, input: { site?: unknown; email?: unknown; token?: unknown }) {
  await requireOwner(orgId, user);
  const site = checkSite(input.site);
  const email = typeof input.email === "string" ? input.email.trim().slice(0, 254) : "";
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!email || !token) throw new AppError("Enter the Jira account's email and an API token.");
  const conn: JiraConnection = { orgId, site, email, token, webhookSecret: "", accountName: "", autoCheck: true };
  let me: { displayName?: string };
  try {
    me = await jira<{ displayName?: string }>(conn, "GET", "/rest/api/3/myself");
  } catch (err) {
    throw new AppError(err instanceof JiraError ? err.message : "We couldn't reach that Jira site.");
  }
  const db = await appDb();
  const existing = await connRow(orgId);
  const secret = existing ? unseal(existing.secretSealed) : randomBytes(24).toString("base64url");
  const accountName = String(me.displayName ?? email).slice(0, 120);
  await db`
    INSERT INTO kl_jira (org_id, site, email, token_sealed, secret_sealed, account_name, connected_by)
    VALUES (${orgId}, ${site}, ${email}, ${seal(token)}, ${seal(secret)}, ${accountName}, ${user.id})
    ON CONFLICT (org_id) DO UPDATE SET site = EXCLUDED.site, email = EXCLUDED.email, token_sealed = EXCLUDED.token_sealed,
      account_name = EXCLUDED.account_name, connected_by = EXCLUDED.connected_by, connected_at = now(), last_error = NULL`;
  await audit(orgId, user, "jira.connected", site, { account: accountName });
  return { site, accountName };
}

export async function disconnectJira(orgId: string, user: AppUser) {
  await requireOwner(orgId, user);
  const db = await appDb();
  const rows = await db<{ site: string }[]>`DELETE FROM kl_jira WHERE org_id = ${orgId} RETURNING site`;
  if (rows[0]) await audit(orgId, user, "jira.disconnected", rows[0].site);
}

export async function setAutoCheck(orgId: string, user: AppUser, on: boolean) {
  await requireOwner(orgId, user);
  const db = await appDb();
  await db`UPDATE kl_jira SET auto_check = ${on} WHERE org_id = ${orgId}`;
}

// ---------- REST client ----------

export class JiraError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function jira<T>(conn: Pick<JiraConnection, "site" | "email" | "token">, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${conn.site}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${conn.email}:${conn.token}`).toString("base64")}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new JiraError((err as Error).name === "TimeoutError" ? "Jira didn't respond in time." : "We couldn't reach Jira.", 502);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return data as T;
  const detail = Array.isArray(data.errorMessages) && data.errorMessages.length ? String(data.errorMessages[0]) : "";
  const message =
    res.status === 401
      ? "Jira rejected the API token. Check the account email and token on the Integrations page."
      : res.status === 403
        ? "The connected Jira account doesn't have permission to do that."
        : res.status === 404
          ? "Jira couldn't find that, or the connected account can't see it."
          : res.status === 429
            ? "Jira is limiting requests. Try again in a minute."
            : `Jira returned an error${detail ? `: ${detail.slice(0, 160)}` : ` (${res.status})`}.`;
  throw new JiraError(message, res.status);
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/;
export function checkIssueKey(raw: unknown): string {
  // Accept a key or a pasted issue link.
  const text = typeof raw === "string" ? raw.trim() : "";
  const match = text.toUpperCase().match(/([A-Z][A-Z0-9_]{0,19}-\d{1,9})(?!.*[A-Z][A-Z0-9_]*-\d)/);
  const key = match?.[1] ?? "";
  if (!ISSUE_KEY.test(key)) throw new DemoError("Enter a Jira issue key like CLM-42, or paste the issue's link.");
  return key;
}

// ---------- Atlassian Document Format ----------

type Adf = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: unknown[]; content?: Adf[] };

/** Jira descriptions are ADF documents; flatten one to plain text for checking. */
export function adfToText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  const n = node as Adf;
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  if (n.type === "mention" || n.type === "emoji") return String(n.attrs?.text ?? "");
  if (n.type === "inlineCard") return String(n.attrs?.url ?? "");
  const inner = (n.content ?? []).map(adfToText).join("");
  if (n.type === "listItem") return `- ${inner.trim()}\n`;
  if (["paragraph", "heading", "blockquote", "codeBlock", "panel", "rule"].includes(n.type)) return `${inner}\n`;
  if (n.type === "tableRow") return `${(n.content ?? []).map((c) => adfToText(c).trim()).join(" | ")}\n`;
  return inner;
}

const t = (text: string, marks?: unknown[]): Adf => ({ type: "text", text, ...(marks ? { marks } : {}) });
const strong = (text: string) => t(text, [{ type: "strong" }]);
const link = (text: string, href: string) => t(text, [{ type: "link", attrs: { href } }]);
const para = (...content: Adf[]): Adf => ({ type: "paragraph", content });
const bullets = (items: Adf[][]): Adf => ({
  type: "bulletList",
  content: items.map((c) => ({ type: "listItem", content: [para(...c)] })),
});
const doc = (...content: Adf[]): Adf => ({ type: "doc", version: 1, content } as Adf);

// ---------- Locks and links ----------

const lockUrl = (lockId: string) => `${appUrl()}/app/l/${lockId}`;

/** The current version in a lock's chain of versions. */
async function latestLock(lockId: string): Promise<string> {
  let id = lockId;
  for (let i = 0; i < 50; i++) {
    const next = await postgresStore.getSupersededBy(id);
    if (!next) return id;
    id = next;
  }
  return id;
}

/** The first version: used as a stable id for the record's web link in Jira. */
async function rootLock(orgId: string, lockId: string): Promise<string> {
  let id = lockId;
  for (let i = 0; i < 50; i++) {
    const found = await orgLock(orgId, id);
    const parent = found?.block.parentLockId;
    if (!parent) return id;
    id = parent;
  }
  return id;
}

/** Every version of a record, oldest to newest. */
async function lockChain(orgId: string, lockId: string): Promise<string[]> {
  const chain = [await rootLock(orgId, lockId)];
  for (let i = 0; i < 50; i++) {
    const next = await postgresStore.getSupersededBy(chain[chain.length - 1]);
    if (!next) break;
    chain.push(next);
  }
  return chain;
}

export type CheckStatus = "clear" | "departs" | "not_covered" | "created" | "error";

export interface JiraLinkView {
  id: string;
  issueKey: string;
  issueUrl: string;
  summary: string;
  lockId: string;
  claimId: string | null;
  status: CheckStatus;
  resultSummary: string;
  findings: { requirementId: string; kind: string; detail: string; excerpt: string }[];
  checkedAt: Date | null;
  checkedBy: string | null;
  auto: boolean;
}

interface LinkRow {
  id: string;
  issueKey: string;
  issueId: string;
  issueSummary: string;
  lockId: string;
  claimId: string | null;
  status: CheckStatus;
  resultSummary: string;
  findings: JiraLinkView["findings"];
  resultKey: string | null;
  textHash: string | null;
  checkedAt: Date | null;
  checkedBy: string | null;
  auto: boolean;
}

const LINK_COLUMNS = `id, issue_key AS "issueKey", issue_id AS "issueId", issue_summary AS "issueSummary", lock_id AS "lockId",
  claim_id AS "claimId", status, result_summary AS "resultSummary", findings, result_key AS "resultKey", text_hash AS "textHash",
  checked_at AS "checkedAt", checked_by AS "checkedBy", auto`;

const toView = (site: string) => (r: LinkRow): JiraLinkView => ({
  id: r.id,
  issueKey: r.issueKey,
  issueUrl: `${site}/browse/${r.issueKey}`,
  summary: r.issueSummary,
  lockId: r.lockId,
  claimId: r.claimId,
  status: r.status,
  resultSummary: r.resultSummary,
  findings: r.findings ?? [],
  checkedAt: r.checkedAt,
  checkedBy: r.checkedBy,
  auto: r.auto,
});

/** What the Jira panel on a locked record shows. */
export async function jiraPanel(user: AppUser, orgId: string, lockId: string) {
  if (!(await memberRole(orgId, user.id))) throw new DemoError("Locked record not found.", 404);
  if (!(await orgLock(orgId, lockId))) throw new DemoError("Locked record not found.", 404);
  const conn = await connRow(orgId);
  if (!conn) return { connected: false as const };
  const chain = await lockChain(orgId, lockId);
  const db = await appDb();
  const rows = await db.unsafe<LinkRow[]>(
    `SELECT ${LINK_COLUMNS} FROM kl_jira_links WHERE org_id = $1 AND lock_id = ANY($2) AND unlinked_at IS NULL ORDER BY claim_id NULLS FIRST, created_at`,
    [orgId, chain]
  );
  const role = await memberRole(orgId, user.id);
  return {
    connected: true as const,
    site: conn.site,
    autoCheck: conn.autoCheck,
    canEdit: role === "owner" || role === "signer",
    current: chain[chain.length - 1] === lockId,
    latestLockId: chain[chain.length - 1],
    links: rows.map(toView(conn.site)),
  };
}

interface IssueData {
  id: string;
  key: string;
  fields: { summary?: string; description?: unknown };
}

/** The text we check: the summary, then the description as plain text. */
function issueText(summary: string, description: unknown): string {
  const body = adfToText(description).replace(/\n{3,}/g, "\n\n").trim();
  return [summary.trim(), body].filter(Boolean).join("\n\n");
}

const hashText = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 32);

async function fetchIssue(conn: JiraConnection, key: string) {
  const issue = await jira<IssueData>(conn, "GET", `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description`);
  const summary = String(issue.fields?.summary ?? "");
  return { id: String(issue.id), key: issue.key, summary, text: issueText(summary, issue.fields?.description) };
}

/** Upserts the record's web link on the issue. One link per record, updated as new versions are locked. */
async function setRemoteLink(conn: JiraConnection, orgId: string, issueKey: string, lockId: string) {
  const found = await orgLock(orgId, lockId);
  if (!found) return;
  const version = Number(found.block.payload.metadata?.version ?? 1);
  const retired = await currentRetirement(lockId);
  await jira(conn, "POST", `/rest/api/3/issue/${encodeURIComponent(issueKey)}/remotelink`, {
    globalId: `knowledge-lock:${orgId}:${await rootLock(orgId, lockId)}`,
    application: { type: "com.guidedorchestration.knowledgelock", name: "Knowledge Lock" },
    relationship: "agreed in",
    object: {
      url: lockUrl(lockId),
      title: `Knowledge Lock: ${found.block.payload.title} (v${version}${retired ? ", retired" : ""})`,
      summary: retired ? "This record has been retired. It's no longer the signed-off version." : "The signed-off version this issue should follow.",
      icon: { url16x16: `${appUrl()}/favicon.ico`, title: "Knowledge Lock" },
    },
  });
}

async function removeRemoteLink(conn: JiraConnection, orgId: string, issueKey: string, lockId: string) {
  const globalId = `knowledge-lock:${orgId}:${await rootLock(orgId, lockId)}`;
  await jira(conn, "DELETE", `/rest/api/3/issue/${encodeURIComponent(issueKey)}/remotelink?globalId=${encodeURIComponent(globalId)}`);
}

const statusOf = (findings: { kind: string }[]): CheckStatus =>
  findings.some((f) => f.kind === "departs") ? "departs" : findings.length ? "not_covered" : "clear";

/** A stable fingerprint of the result, ignoring the AI's exact wording, so automatic checks only comment on real changes. */
const resultKeyOf = (lockId: string, findings: { requirementId: string; kind: string }[]) =>
  createHash("sha256")
    .update(`${lockId}|${findings.map((f) => `${f.requirementId}:${f.kind}`).sort().join(",")}`)
    .digest("hex")
    .slice(0, 32);

function commentFor(p: {
  status: CheckStatus;
  summary: string;
  findings: JiraLinkView["findings"];
  title: string;
  version: number;
  lockId: string;
  who: string;
}) {
  const headline =
    p.status === "clear"
      ? "✅ Knowledge Lock: this issue matches the agreed version."
      : p.status === "departs"
        ? `⚠️ Knowledge Lock: this issue departs from the agreed version (${p.findings.filter((f) => f.kind === "departs").length}).`
        : "ℹ️ Knowledge Lock: this issue adds things the agreed version doesn't cover.";
  return doc(
    para(strong(headline)),
    ...(p.summary ? [para(t(p.summary))] : []),
    ...(p.findings.length
      ? [
          bullets(
            p.findings.map((f) => [
              strong(`${f.requirementId} ${f.kind === "departs" ? "departs" : "not covered"}: `),
              t(f.detail),
              ...(f.excerpt ? [t(` (“${f.excerpt}”)`)] : []),
            ])
          ),
        ]
      : []),
    para(t("Checked against "), link(`${p.title} (v${p.version})`, lockUrl(p.lockId)), t(`. ${p.who}`))
  );
}

/** Checks one issue against the current version of a locked record, and records and comments the result. */
async function runCheck(
  conn: JiraConnection,
  opts: { lockId: string; issueKey: string; actor: AppUser | null; auto: boolean }
): Promise<JiraLinkView> {
  const orgId = conn.orgId;
  const issue = await fetchIssue(conn, opts.issueKey);
  if (!issue.text) throw new DemoError(`${issue.key} has no summary or description to check.`);
  const lockId = await latestLock(opts.lockId);
  const found = await orgLock(orgId, lockId);
  if (!found) throw new DemoError("Locked record not found.", 404);
  const result = await checkOrgDrift(orgId, lockId, issue.text);
  const status = statusOf(result.findings);
  const resultKey = resultKeyOf(lockId, result.findings);
  const textHash = hashText(issue.text);
  const db = await appDb();
  const checkedBy = opts.actor ? opts.actor.email : "Automatic check";
  const [prev] = await db<LinkRow[]>`
    SELECT id, result_key AS "resultKey" FROM kl_jira_links WHERE org_id = ${orgId} AND issue_id = ${issue.id} AND unlinked_at IS NULL`;
  const id = prev?.id ?? `jl_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db`
    INSERT INTO kl_jira_links (id, org_id, issue_id, issue_key, issue_summary, lock_id, record_id, status, result_summary, findings,
                               result_key, text_hash, checked_at, checked_by, auto, linked_by)
    VALUES (${id}, ${orgId}, ${issue.id}, ${issue.key}, ${issue.summary.slice(0, 300)}, ${lockId}, ${found.recordId}, ${status},
            ${result.summary}, ${db.json(result.findings as never)}, ${resultKey}, ${textHash}, now(), ${checkedBy}, ${opts.auto},
            ${opts.actor?.id ?? "jira"})
    ON CONFLICT (id) DO UPDATE SET issue_key = EXCLUDED.issue_key, issue_summary = EXCLUDED.issue_summary, lock_id = EXCLUDED.lock_id,
      record_id = EXCLUDED.record_id, status = EXCLUDED.status, result_summary = EXCLUDED.result_summary, findings = EXCLUDED.findings,
      result_key = EXCLUDED.result_key, text_hash = EXCLUDED.text_hash, checked_at = now(), checked_by = EXCLUDED.checked_by,
      auto = EXCLUDED.auto`;
  // People asking always get a comment; automatic checks only comment when the result has changed.
  if (!opts.auto || prev?.resultKey !== resultKey) {
    await jira(conn, "POST", `/rest/api/3/issue/${encodeURIComponent(issue.key)}/comment`, {
      body: commentFor({
        status,
        summary: result.summary,
        findings: result.findings,
        title: found.block.payload.title,
        version: Number(found.block.payload.metadata?.version ?? 1),
        lockId,
        who: opts.auto ? "Re-checked automatically because the issue changed." : `Checked by ${checkedBy}.`,
      }),
    });
  }
  await setRemoteLink(conn, orgId, issue.key, lockId).catch((err) => console.warn("[knowledge-lock] jira remote link", err));
  await audit(orgId, opts.actor, "jira.checked", issue.key, { lockId, status, auto: opts.auto });
  const [row] = await db.unsafe<LinkRow[]>(`SELECT ${LINK_COLUMNS} FROM kl_jira_links WHERE id = $1`, [id]);
  return toView(conn.site)(row);
}

async function connectionFor(orgId: string): Promise<JiraConnection> {
  const conn = await getConnection(orgId);
  if (!conn) throw new DemoError("Jira isn't connected. An owner can connect it on the Integrations page.", 409);
  return conn;
}

const asDemoError = (err: unknown) => (err instanceof JiraError ? new DemoError(err.message, err.status === 404 ? 404 : 502) : err);

/** Someone links an issue to a locked record, or checks it again. */
export async function checkIssue(user: AppUser, orgId: string, lockId: string, issueKeyRaw: unknown): Promise<JiraLinkView> {
  await requireEditor(orgId, user);
  if (!(await orgLock(orgId, lockId))) throw new DemoError("Locked record not found.", 404);
  const conn = await connectionFor(orgId);
  try {
    return await runCheck(conn, { lockId, issueKey: checkIssueKey(issueKeyRaw), actor: user, auto: false });
  } catch (err) {
    throw asDemoError(err);
  }
}

export async function recheckLink(user: AppUser, orgId: string, linkId: string): Promise<JiraLinkView> {
  await requireEditor(orgId, user);
  const db = await appDb();
  const [row] = await db<{ issueKey: string; lockId: string }[]>`
    SELECT issue_key AS "issueKey", lock_id AS "lockId" FROM kl_jira_links WHERE id = ${linkId} AND org_id = ${orgId} AND unlinked_at IS NULL`;
  if (!row) throw new DemoError("That issue isn't linked any more.", 404);
  const conn = await connectionFor(orgId);
  try {
    return await runCheck(conn, { lockId: row.lockId, issueKey: row.issueKey, actor: user, auto: false });
  } catch (err) {
    throw asDemoError(err);
  }
}

export async function unlinkIssue(user: AppUser, orgId: string, linkId: string): Promise<void> {
  await requireEditor(orgId, user);
  const db = await appDb();
  const [row] = await db<{ issueKey: string; lockId: string }[]>`
    UPDATE kl_jira_links SET unlinked_at = now() WHERE id = ${linkId} AND org_id = ${orgId} AND unlinked_at IS NULL
    RETURNING issue_key AS "issueKey", lock_id AS "lockId"`;
  if (!row) return;
  const conn = await getConnection(orgId);
  if (conn) await removeRemoteLink(conn, orgId, row.issueKey, row.lockId).catch(() => {});
  await audit(orgId, user, "jira.unlinked", row.issueKey);
}

/** Which organisation a link belongs to (membership is checked by the caller's action). */
export async function linkOrg(linkId: string): Promise<string | null> {
  const db = await appDb();
  const [row] = await db<{ orgId: string }[]>`SELECT org_id AS "orgId" FROM kl_jira_links WHERE id = ${linkId}`;
  return row?.orgId ?? null;
}

// ---------- Creating issues ----------

export async function listProjects(user: AppUser, orgId: string): Promise<{ key: string; name: string }[]> {
  await requireEditor(orgId, user);
  const conn = await connectionFor(orgId);
  try {
    const data = await jira<{ values?: { key: string; name: string }[] }>(conn, "GET", "/rest/api/3/project/search?maxResults=100&orderBy=name");
    return (data.values ?? []).map((p) => ({ key: p.key, name: p.name }));
  } catch (err) {
    throw asDemoError(err);
  }
}

async function storyType(conn: JiraConnection, projectKey: string): Promise<{ id: string; name: string }> {
  const data = await jira<{ issueTypes?: { id: string; name: string; subtask?: boolean }[]; values?: { id: string; name: string; subtask?: boolean }[] }>(
    conn,
    "GET",
    `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`
  );
  const types = (data.issueTypes ?? data.values ?? []).filter((t) => !t.subtask);
  const pick = types.find((t) => t.name === "Story") ?? types.find((t) => t.name === "Task") ?? types[0];
  if (!pick) throw new DemoError(`We couldn't find an issue type to use in ${projectKey}.`, 409);
  return { id: String(pick.id), name: pick.name };
}

/** One Jira issue per requirement, each linked back to the lock. Requirements that already have an issue are skipped. */
export async function createIssues(user: AppUser, orgId: string, lockId: string, projectKeyRaw: unknown) {
  await requireEditor(orgId, user);
  const found = await orgLock(orgId, lockId);
  if (!found) throw new DemoError("Locked record not found.", 404);
  if (await postgresStore.getSupersededBy(lockId)) throw new DemoError("This version has been replaced. Create issues from the current version.", 409);
  const retired = await currentRetirement(lockId);
  if (retired) throw new DemoError(retiredMessage(retired), 410);
  const projectKey = typeof projectKeyRaw === "string" ? projectKeyRaw.trim().toUpperCase() : "";
  if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(projectKey)) throw new DemoError("Choose a Jira project.");
  const conn = await connectionFor(orgId);
  const db = await appDb();
  const chain = await lockChain(orgId, lockId);
  const already = new Set(
    (
      await db.unsafe<{ claimId: string }[]>(
        `SELECT claim_id AS "claimId" FROM kl_jira_links WHERE org_id = $1 AND lock_id = ANY($2) AND claim_id IS NOT NULL AND unlinked_at IS NULL`,
        [orgId, chain]
      )
    ).map((r) => r.claimId)
  );
  const claims = found.block.payload.claims.filter((c) => !already.has(c.id));
  if (!claims.length) return { created: [] as string[], skipped: already.size };
  const version = Number(found.block.payload.metadata?.version ?? 1);
  const created: string[] = [];
  try {
    const type = await storyType(conn, projectKey);
    for (const c of claims) {
      const summary = `${c.id}: ${c.statement}`.slice(0, 250);
      const description = doc(
        para(t(c.statement)),
        para(
          t("Agreed and locked in "),
          link(`${found.block.payload.title} (v${version})`, lockUrl(lockId)),
          t(`, requirement ${c.id}. Changes to what this issue should do go back through review there.`)
        )
      );
      const issue = await jira<{ id: string; key: string }>(conn, "POST", "/rest/api/3/issue", {
        fields: { project: { key: projectKey }, issuetype: { id: type.id }, summary, labels: ["knowledge-lock"], description },
      });
      // Remember the text we wrote, so Jira's "issue created" event doesn't trigger a pointless check.
      const textHash = hashText(issueText(summary, description));
      created.push(issue.key);
      await db`
        INSERT INTO kl_jira_links (id, org_id, issue_id, issue_key, issue_summary, lock_id, record_id, claim_id, status, result_summary,
                                   findings, text_hash, linked_by, checked_by)
        VALUES (${`jl_${randomUUID().replace(/-/g, "").slice(0, 16)}`}, ${orgId}, ${String(issue.id)}, ${issue.key},
                ${summary.slice(0, 300)}, ${lockId}, ${found.recordId}, ${c.id}, 'created', '', '[]'::jsonb, ${textHash}, ${user.id}, ${user.email})`;
      await setRemoteLink(conn, orgId, issue.key, lockId).catch((err) => console.warn("[knowledge-lock] jira remote link", err));
    }
  } catch (err) {
    if (created.length) await audit(orgId, user, "jira.issues_created", projectKey, { lockId, issues: created });
    const e = asDemoError(err);
    if (created.length && e instanceof DemoError) throw new DemoError(`Created ${created.join(", ")}, then stopped: ${e.message}`, e.status);
    throw e;
  }
  await audit(orgId, user, "jira.issues_created", projectKey, { lockId, issues: created });
  return { created, skipped: already.size };
}

// ---------- New versions ----------

/** When a record is locked as a new version, its linked issues move to it, get the new link, and are re-checked if automatic checks are on. */
export async function onNewVersion(orgId: string, parentLockId: string, newLockId: string) {
  const conn = await getConnection(orgId);
  if (!conn) return;
  const db = await appDb();
  const rows = await db.unsafe<LinkRow[]>(
    `UPDATE kl_jira_links SET lock_id = $1 WHERE org_id = $2 AND lock_id = $3 AND unlinked_at IS NULL RETURNING ${LINK_COLUMNS}`,
    [newLockId, orgId, parentLockId]
  );
  for (const r of rows.slice(0, 30)) {
    try {
      if (conn.autoCheck && !r.claimId) await runCheck(conn, { lockId: newLockId, issueKey: r.issueKey, actor: null, auto: true });
      else await setRemoteLink(conn, orgId, r.issueKey, newLockId);
    } catch (err) {
      console.warn("[knowledge-lock] jira new version", r.issueKey, (err as Error).message);
    }
  }
}

// ---------- Retired records ----------

const longDate = (ms: number) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(ms);

/** Tells each issue linked to a record that it has been retired (or restored), and updates its web link. */
async function tellLinkedIssues(orgId: string, lockId: string, body: (title: string, version: number) => unknown) {
  const conn = await getConnection(orgId);
  if (!conn) return;
  const found = await orgLock(orgId, lockId);
  if (!found) return;
  const version = Number(found.block.payload.metadata?.version ?? 1);
  const db = await appDb();
  const rows = await db<{ issueKey: string }[]>`
    SELECT issue_key AS "issueKey" FROM kl_jira_links WHERE org_id = ${orgId} AND lock_id = ${lockId} AND unlinked_at IS NULL`;
  for (const r of rows.slice(0, 50)) {
    try {
      await jira(conn, "POST", `/rest/api/3/issue/${encodeURIComponent(r.issueKey)}/comment`, { body: body(found.block.payload.title, version) });
      await setRemoteLink(conn, orgId, r.issueKey, lockId);
    } catch (err) {
      console.warn("[knowledge-lock] jira retired notice", r.issueKey, (err as Error).message);
    }
  }
}

export async function onRetired(orgId: string, retirement: Retirement) {
  await tellLinkedIssues(orgId, retirement.lockId, (title, version) =>
    doc(
      para(strong("🛑 Knowledge Lock: the record this issue follows has been retired.")),
      para(
        link(`${title} (v${version})`, lockUrl(retirement.lockId)),
        t(` was retired by ${retirement.by} on ${longDate(retirement.at)}. It's no longer the signed-off version, so this issue isn't checked against it any more.`)
      ),
      para(t(`Reason: ${retirement.reason}`))
    )
  );
}

export async function onRestored(orgId: string, lockId: string, by: string) {
  await tellLinkedIssues(orgId, lockId, (title, version) =>
    doc(
      para(strong("✅ Knowledge Lock: the record this issue follows is back in use.")),
      para(link(`${title} (v${version})`, lockUrl(lockId)), t(` was restored by ${by}. It's the signed-off version again.`))
    )
  );
}

// ---------- Webhook ----------

export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.slice(7);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

interface WebhookPayload {
  webhookEvent?: string;
  issue?: { id?: string | number; key?: string };
  changelog?: { items?: { field?: string; fieldId?: string }[] };
}

/**
 * Checks the request is genuinely from this organisation's Jira, and returns the work to do afterwards
 * (Jira expects a quick reply), or null when there's nothing to do.
 */
export async function acceptWebhook(orgId: string, rawBody: string, signature: string | null): Promise<(() => Promise<void>) | null> {
  const conn = await getConnection(orgId);
  if (!conn || !verifySignature(conn.webhookSecret, rawBody, signature)) throw new DemoError("Signature check failed.", 401);
  const db = await appDb();
  await db`UPDATE kl_jira SET last_webhook_at = now() WHERE org_id = ${orgId}`;
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return null;
  }
  const event = payload.webhookEvent;
  if (event !== "jira:issue_created" && event !== "jira:issue_updated") return null;
  if (event === "jira:issue_updated") {
    const fields = (payload.changelog?.items ?? []).map((i) => i.fieldId ?? i.field);
    if (!fields.some((f) => f === "summary" || f === "description")) return null;
  }
  const issueId = String(payload.issue?.id ?? "");
  if (!issueId || !conn.autoCheck) return null;
  const [link] = await db.unsafe<LinkRow[]>(`SELECT ${LINK_COLUMNS} FROM kl_jira_links WHERE org_id = $1 AND issue_id = $2 AND unlinked_at IS NULL`, [
    orgId,
    issueId,
  ]);
  if (!link) return null;
  // A retired record isn't checked against any more.
  if (await retiredFor(link.lockId)) return null;
  return async () => {
    try {
      // Skip if the text we check hasn't actually changed (Jira can send several events for one edit).
      const issue = await fetchIssue(conn, link.issueKey);
      if (hashText(issue.text) === link.textHash) return;
      await runCheck(conn, { lockId: link.lockId, issueKey: issue.key, actor: null, auto: true });
    } catch (err) {
      console.warn("[knowledge-lock] jira automatic check", link.issueKey, (err as Error).message);
      await db`UPDATE kl_jira SET last_error = ${`Automatic check of ${link.issueKey} failed: ${(err as Error).message}`.slice(0, 300)} WHERE org_id = ${orgId}`;
    }
  };
}
