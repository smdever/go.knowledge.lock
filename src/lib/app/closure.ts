import { verifyKnowledgeLock, type KnowledgeLockBlock } from "@/lib/protocol";
import { appUrl } from "@/lib/mode";
import type { AppUser } from "./auth";
import { listActivity } from "./activity";
import { eraseAccountData } from "./account";
import { appDb } from "./db";
import { noticeEmail, sendEmail } from "./email";
import { AppError, audit, getProfile, isAdmin, longDate } from "./orgs";
import { listOrgLocks, type AppRecord } from "./records";

/**
 * Closing an organisation. An owner asks; the organisation becomes read-only for GRACE_DAYS, during which
 * any owner can cancel or download everything; then the daily job deletes everything in it for good,
 * locks and the activity log included.
 */
export const GRACE_DAYS = 30;

async function requireOwner(orgId: string, user: AppUser): Promise<string> {
  const db = await appDb();
  const [m] = await db<{ role: string; name: string }[]>`
    SELECT m.role, o.name FROM kl_members m JOIN kl_organisations o ON o.id = m.org_id WHERE m.org_id = ${orgId} AND m.user_id = ${user.id}`;
  if (m?.role !== "owner") throw new AppError("Only owners can do that.");
  return m.name;
}

async function emailMembers(orgId: string, mail: ReturnType<typeof noticeEmail>) {
  const db = await appDb();
  const rows = await db<{ email: string }[]>`SELECT email FROM kl_members WHERE org_id = ${orgId}`;
  for (const r of rows) await sendEmail(r.email, mail.subject, mail.html, mail.text).catch((err) => console.error("[knowledge-lock] closure email", err));
}

// ---------- Closing and cancelling ----------

export async function closeOrganisation(orgId: string, user: AppUser, confirmRaw: unknown): Promise<Date> {
  const name = await requireOwner(orgId, user);
  const confirm = typeof confirmRaw === "string" ? confirmRaw.trim().toLowerCase() : "";
  if (confirm !== name.trim().toLowerCase()) throw new AppError(`Type the organisation's name, ${name}, to confirm.`);
  const by = (await getProfile(user.id))?.name || user.email;
  const db = await appDb();
  const [row] = await db<{ deleteAfter: Date }[]>`
    UPDATE kl_organisations SET closing_at = now(), closing_by = ${user.id}, closing_by_name = ${by},
      delete_after = now() + make_interval(days => ${GRACE_DAYS})
    WHERE id = ${orgId} AND closing_at IS NULL RETURNING delete_after AS "deleteAfter"`;
  if (!row) throw new AppError(`${name} is already closing.`);
  await audit(orgId, user, "org.closing", name, { deleteAfter: row.deleteAfter.toISOString() });
  await emailMembers(
    orgId,
    noticeEmail({
      orgName: name,
      subject: `${name} is closing on Knowledge Lock`,
      heading: `${name} is closing`,
      lines: [
        `${by} asked to close ${name} on Knowledge Lock. On ${longDate(row.deleteAfter)}, everything in it will be permanently deleted: records, locks, the activity log and integrations.`,
        "Until then it's read-only. The API, Jira checks and Slack or Teams notices are switched off. Owners can download everything, or cancel the closure, on the Team page.",
      ],
      cta: "Open the Team page",
      url: `${appUrl()}/app/team`,
    })
  );
  return row.deleteAfter;
}

export async function cancelClosure(orgId: string, user: AppUser): Promise<void> {
  const name = await requireOwner(orgId, user);
  const db = await appDb();
  const rows = await db`
    UPDATE kl_organisations SET closing_at = NULL, closing_by = NULL, closing_by_name = NULL, delete_after = NULL
    WHERE id = ${orgId} AND closing_at IS NOT NULL RETURNING id`;
  if (!rows.length) throw new AppError(`${name} isn't closing.`);
  await audit(orgId, user, "org.closure_cancelled", name);
  const by = (await getProfile(user.id))?.name || user.email;
  await emailMembers(
    orgId,
    noticeEmail({
      orgName: name,
      subject: `${name} is no longer closing`,
      heading: `${name} is staying open`,
      lines: [`${by} cancelled the closure of ${name}. Nothing will be deleted, and everything works as before.`],
      cta: "Open Knowledge Lock",
      url: `${appUrl()}/app`,
    })
  );
}

// ---------- Download everything ----------

/** Every lock (with its verification result), every draft, the members and the full activity log. Owners only. */
export async function exportOrganisation(orgId: string, user: AppUser) {
  const name = await requireOwner(orgId, user);
  const db = await appDb();
  const [org] = await db<{ createdAt: Date; policyLockId: string | null; deleteAfter: Date | null }[]>`
    SELECT created_at AS "createdAt", policy_lock_id AS "policyLockId", delete_after AS "deleteAfter" FROM kl_organisations WHERE id = ${orgId}`;
  const members = await db<{ name: string | null; title: string | null; email: string; role: string; joinedAt: Date }[]>`
    SELECT p.name, p.title, m.email, m.role, m.created_at AS "joinedAt"
    FROM kl_members m LEFT JOIN kl_profiles p ON p.user_id = m.user_id WHERE m.org_id = ${orgId} ORDER BY m.created_at`;
  const summaries = await listOrgLocks(orgId, { replaced: true, retired: true });
  const blocks = summaries.length
    ? await db<{ lockId: string; block: KnowledgeLockBlock }[]>`SELECT lock_id AS "lockId", block FROM kl_locks WHERE lock_id IN ${db(summaries.map((s) => s.lockId))}`
    : [];
  const byId = new Map(blocks.map((b) => [b.lockId, b.block]));
  const locks = [];
  for (const s of summaries) {
    const block = byId.get(s.lockId);
    if (!block) continue;
    locks.push({ lock: block, verified: (await verifyKnowledgeLock(block)).valid, supersededBy: s.supersededBy, retired: s.retired });
  }
  const drafts = await db<{ data: AppRecord; createdAt: Date }[]>`
    SELECT data, created_at AS "createdAt" FROM kl_app_records WHERE org_id = ${orgId} AND status = 'draft' ORDER BY created_at`;
  const activity = await listActivity(orgId, 100_000);
  return {
    organisation: {
      name,
      createdAt: org.createdAt.toISOString(),
      policyLockId: org.policyLockId,
      ...(org.deleteAfter ? { closing: { deleteAfter: org.deleteAfter.toISOString() } } : {}),
    },
    exportedAt: new Date().toISOString(),
    about:
      "Everything in this organisation on Knowledge Lock. Each lock is the signed block exactly as stored; anyone can re-check its fingerprint and signature without us.",
    members: members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() })),
    locks,
    drafts: drafts.map(({ data: d, createdAt }) => ({
      recordId: d.id,
      kind: d.kind,
      title: d.payload.title,
      version: d.version,
      statements: d.payload.claims.map((c) => ({ id: c.id, statement: c.statement })),
      signers: d.signers.map((s) => ({ name: s.name, title: s.title, email: s.email })),
      quorum: d.quorum,
      archived: Boolean(d.archived),
      createdAt: createdAt.toISOString(),
    })),
    activity: activity
      .slice()
      .reverse()
      .map((a) => ({ at: a.at.toISOString(), who: a.actor, what: a.text, ...(a.note ? { note: a.note } : {}) })),
  };
}

// ---------- Deleting ----------

/** Deletes everything for one organisation in a single transaction. Locks and the audit log are append-only, so their guards are lifted for this delete only. */
export async function purgeOrganisation(orgId: string): Promise<void> {
  const db = await appDb();
  const [org] = await db<{ name: string }[]>`SELECT name FROM kl_organisations WHERE id = ${orgId}`;
  if (!org) return;
  const members = await db<{ userId: string; email: string; role: string }[]>`
    SELECT user_id AS "userId", email, role FROM kl_members WHERE org_id = ${orgId}`;

  await db.begin(async (tx) => {
    const records = (await tx<{ id: string }[]>`SELECT id FROM kl_app_records WHERE org_id = ${orgId}`).map((r) => r.id);
    const locks = records.length ? (await tx<{ lockId: string }[]>`SELECT lock_id AS "lockId" FROM kl_locks WHERE record_id IN ${tx(records)}`).map((r) => r.lockId) : [];
    await tx`ALTER TABLE kl_locks DISABLE TRIGGER kl_locks_append_only`;
    await tx`ALTER TABLE kl_supersessions DISABLE TRIGGER kl_supersessions_append_only`;
    await tx`ALTER TABLE kl_audit DISABLE TRIGGER kl_audit_append_only`;
    if (locks.length) {
      await tx`DELETE FROM kl_supersessions WHERE lock_id IN ${tx(locks)} OR superseded_by IN ${tx(locks)}`;
      await tx`DELETE FROM kl_locks WHERE lock_id IN ${tx(locks)}`;
    }
    await tx`DELETE FROM kl_audit WHERE org_id = ${orgId}`;
    await tx`ALTER TABLE kl_locks ENABLE TRIGGER kl_locks_append_only`;
    await tx`ALTER TABLE kl_supersessions ENABLE TRIGGER kl_supersessions_append_only`;
    await tx`ALTER TABLE kl_audit ENABLE TRIGGER kl_audit_append_only`;
    await tx`DELETE FROM kl_jira_links WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_jira WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_channels WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_api_keys WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_invites WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_retirements WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_app_records WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_members WHERE org_id = ${orgId}`;
    await tx`UPDATE kl_access_requests SET org_id = NULL WHERE org_id = ${orgId}`;
    await tx`DELETE FROM kl_organisations WHERE id = ${orgId}`;
  });
  await audit(null, null, "org.deleted", org.name, { orgId, members: members.length });

  // People who aren't in any other organisation have nothing left here, so their accounts go too.
  for (const m of members) {
    const [other] = await db`SELECT 1 FROM kl_members WHERE user_id = ${m.userId} LIMIT 1`;
    if (!other && !isAdmin(m.email)) await eraseAccountData(m.userId, m.email);
  }
  const mail = noticeEmail({
    orgName: org.name,
    subject: `${org.name} has been deleted from Knowledge Lock`,
    heading: `${org.name} has been deleted`,
    lines: [
      `As requested ${GRACE_DAYS} days ago, everything in ${org.name} on Knowledge Lock has been permanently deleted. Accounts that weren't in any other organisation were deleted too.`,
    ],
    cta: "Read our privacy notice",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com"}/privacy`,
    footer: "Knowledge Lock, by Guided Orchestration Ltd. This is the last email you'll get about this organisation.",
  });
  for (const m of members.filter((x) => x.role === "owner")) {
    await sendEmail(m.email, mail.subject, mail.html, mail.text).catch(() => {});
  }
}

/** Run daily: deletes organisations whose grace period has ended. Returns how many. */
export async function purgeDueOrganisations(now = new Date()): Promise<number> {
  const db = await appDb();
  const due = await db<{ id: string }[]>`SELECT id FROM kl_organisations WHERE delete_after IS NOT NULL AND delete_after <= ${now}`;
  let n = 0;
  for (const { id } of due) {
    try {
      await purgeOrganisation(id);
      n++;
    } catch (err) {
      console.error("[knowledge-lock] couldn't delete organisation", id, err);
    }
  }
  return n;
}
