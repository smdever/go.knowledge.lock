import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appDb } from "./db";
import type { AppUser } from "./auth";

import { ROLES, type Role } from "./roles";

export { ROLE_LABEL, ROLES, type Role } from "./roles";

/** A message that is safe to show the person. */
export class AppError extends Error {}

const INVITE_DAYS = 7;
const MAX_PENDING_INVITES = 50;
const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normEmail = (email: string) => email.trim().toLowerCase();
const isRole = (r: unknown): r is Role => typeof r === "string" && (ROLES as string[]).includes(r);

export function isAdmin(email: string) {
  return (process.env.KL_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export function checkEmail(raw: unknown): string {
  const email = typeof raw === "string" ? normEmail(raw) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) throw new AppError("Enter a valid email address.");
  return email;
}

export async function audit(orgId: string | null, actor: AppUser | null, action: string, target?: string, detail?: object) {
  const db = await appDb();
  await db`INSERT INTO kl_audit (org_id, actor_id, actor_email, action, target, detail)
           VALUES (${orgId}, ${actor?.id ?? null}, ${actor?.email ?? null}, ${action}, ${target ?? null}, ${detail ? db.json(detail as never) : null})`;
}

// ---------- Profiles ----------

export interface Profile {
  userId: string;
  email: string;
  name: string;
  title: string;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = await appDb();
  const [p] = await db<Profile[]>`SELECT user_id AS "userId", email, name, title FROM kl_profiles WHERE user_id = ${userId}`;
  return p ?? null;
}

export async function saveProfile(user: AppUser, nameRaw: unknown, titleRaw: unknown): Promise<void> {
  const name = typeof nameRaw === "string" ? nameRaw.trim().slice(0, 80) : "";
  const title = typeof titleRaw === "string" ? titleRaw.trim().slice(0, 80) : "";
  if (!name) throw new AppError("Enter your name.");
  const db = await appDb();
  await db`INSERT INTO kl_profiles (user_id, email, name, title) VALUES (${user.id}, ${user.email}, ${name}, ${title})
           ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, title = EXCLUDED.title, updated_at = now()`;
}

// ---------- Organisations and membership ----------

export interface Membership {
  orgId: string;
  orgName: string;
  role: Role;
  /** Set while an owner's request to close the organisation is waiting out its grace period. */
  closing: { by: string; deleteAfter: Date } | null;
}

export async function listMemberships(userId: string): Promise<Membership[]> {
  const db = await appDb();
  const rows = await db<(Omit<Membership, "closing"> & { closingBy: string | null; deleteAfter: Date | null })[]>`
    SELECT m.org_id AS "orgId", o.name AS "orgName", m.role, o.closing_by_name AS "closingBy", o.delete_after AS "deleteAfter"
    FROM kl_members m JOIN kl_organisations o ON o.id = m.org_id
    WHERE m.user_id = ${userId} ORDER BY o.name`;
  return rows.map(({ closingBy, deleteAfter, ...m }) => ({ ...m, closing: deleteAfter ? { by: closingBy ?? "", deleteAfter } : null }));
}

// ---------- Closing organisations ----------

export const longDate = (d: Date | number) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d);

/** When a closing organisation will be deleted, or null if it isn't closing. */
export async function closingDate(orgId: string): Promise<{ name: string; deleteAfter: Date } | null> {
  const db = await appDb();
  const [o] = await db<{ name: string; deleteAfter: Date | null }[]>`SELECT name, delete_after AS "deleteAfter" FROM kl_organisations WHERE id = ${orgId}`;
  return o?.deleteAfter ? { name: o.name, deleteAfter: o.deleteAfter } : null;
}

export class ClosingError extends AppError {}

/** A closing organisation is read-only: nothing new is created, signed, locked, checked or sent. */
export async function assertOrgOpen(orgId: string): Promise<void> {
  const c = await closingDate(orgId);
  if (c) {
    throw new ClosingError(
      `${c.name} is closing, so nothing can be changed. Everything in it will be deleted on ${longDate(c.deleteAfter)}. An owner can cancel the closure on the Team page.`
    );
  }
}

export interface Member {
  userId: string;
  email: string;
  role: Role;
  name: string | null;
  title: string | null;
  joinedAt: Date;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  const db = await appDb();
  return db<Member[]>`
    SELECT m.user_id AS "userId", m.email, m.role, p.name, p.title, m.created_at AS "joinedAt"
    FROM kl_members m LEFT JOIN kl_profiles p ON p.user_id = m.user_id
    WHERE m.org_id = ${orgId}
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'signer' THEN 1 ELSE 2 END, coalesce(p.name, m.email)`;
}

async function requireRole(orgId: string, user: AppUser, roles: Role[]): Promise<Role> {
  const db = await appDb();
  const [m] = await db<{ role: Role }[]>`SELECT role FROM kl_members WHERE org_id = ${orgId} AND user_id = ${user.id}`;
  if (!m || !roles.includes(m.role)) throw new AppError("You don't have permission to do that.");
  return m.role;
}

export async function ownerCount(orgId: string) {
  const db = await appDb();
  const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM kl_members WHERE org_id = ${orgId} AND role = 'owner'`;
  return r.n;
}

export async function changeRole(orgId: string, actor: AppUser, userId: string, roleRaw: unknown) {
  await requireRole(orgId, actor, ["owner"]);
  await assertOrgOpen(orgId);
  if (!isRole(roleRaw)) throw new AppError("Choose a role.");
  const db = await appDb();
  const [target] = await db<{ role: Role; email: string }[]>`SELECT role, email FROM kl_members WHERE org_id = ${orgId} AND user_id = ${userId}`;
  if (!target) throw new AppError("That person isn't in this organisation.");
  if (target.role === "owner" && roleRaw !== "owner" && (await ownerCount(orgId)) <= 1)
    throw new AppError("Every organisation needs at least one owner.");
  await db`UPDATE kl_members SET role = ${roleRaw} WHERE org_id = ${orgId} AND user_id = ${userId}`;
  await audit(orgId, actor, "member.role_changed", target.email, { from: target.role, to: roleRaw });
}

export async function removeMember(orgId: string, actor: AppUser, userId: string) {
  await requireRole(orgId, actor, ["owner"]);
  const db = await appDb();
  const [target] = await db<{ role: Role; email: string }[]>`SELECT role, email FROM kl_members WHERE org_id = ${orgId} AND user_id = ${userId}`;
  if (!target) throw new AppError("That person isn't in this organisation.");
  if (target.role === "owner" && (await ownerCount(orgId)) <= 1) throw new AppError("Every organisation needs at least one owner.");
  await db`DELETE FROM kl_members WHERE org_id = ${orgId} AND user_id = ${userId}`;
  await audit(orgId, actor, "member.removed", target.email);
}

/** Owners can require every sign-off to be signed with the person's own passkey. Applies to records started from now on. */
export async function setRequirePasskeys(orgId: string, actor: AppUser, on: boolean) {
  await requireRole(orgId, actor, ["owner"]);
  await assertOrgOpen(orgId);
  const db = await appDb();
  const rows = await db`UPDATE kl_organisations SET require_passkeys = ${on} WHERE id = ${orgId} AND require_passkeys <> ${on} RETURNING id`;
  if (rows.length) await audit(orgId, actor, on ? "org.passkeys_required" : "org.passkeys_optional");
}

export async function requiresPasskeys(orgId: string): Promise<boolean> {
  const db = await appDb();
  const [o] = await db<{ on: boolean }[]>`SELECT require_passkeys AS on FROM kl_organisations WHERE id = ${orgId}`;
  return Boolean(o?.on);
}

// ---------- Invites ----------

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  expiresAt: Date;
}

export async function listInvites(orgId: string): Promise<PendingInvite[]> {
  const db = await appDb();
  return db<PendingInvite[]>`
    SELECT id, email, role, created_at AS "createdAt", expires_at AS "expiresAt" FROM kl_invites
    WHERE org_id = ${orgId} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC`;
}

async function insertInvite(orgId: string, actor: AppUser, email: string, role: Role) {
  const db = await appDb();
  // A new invite replaces any earlier pending one for the same person.
  await db`UPDATE kl_invites SET revoked_at = now()
           WHERE org_id = ${orgId} AND email = ${email} AND accepted_at IS NULL AND revoked_at IS NULL`;
  const token = randomBytes(32).toString("base64url");
  const id = newId("inv");
  await db`INSERT INTO kl_invites (id, org_id, email, role, token_hash, invited_by, expires_at)
           VALUES (${id}, ${orgId}, ${email}, ${role}, ${hashToken(token)}, ${actor.id}, now() + ${`${INVITE_DAYS} days`}::interval)`;
  await audit(orgId, actor, "invite.created", email, { role });
  return { id, token };
}

export async function createInvite(orgId: string, actor: AppUser, emailRaw: unknown, roleRaw: unknown) {
  await requireRole(orgId, actor, ["owner"]);
  await assertOrgOpen(orgId);
  const email = checkEmail(emailRaw);
  if (!isRole(roleRaw)) throw new AppError("Choose a role.");
  const db = await appDb();
  const [existing] = await db`SELECT 1 FROM kl_members WHERE org_id = ${orgId} AND email = ${email}`;
  if (existing) throw new AppError(`${email} is already in this organisation.`);
  const [pending] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM kl_invites
    WHERE org_id = ${orgId} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
  if (pending.n >= MAX_PENDING_INVITES) throw new AppError(`There are already ${MAX_PENDING_INVITES} invites waiting. Cancel some before sending more.`);
  return insertInvite(orgId, actor, email, roleRaw);
}

export async function revokeInvite(orgId: string, actor: AppUser, inviteId: string) {
  await requireRole(orgId, actor, ["owner"]);
  const db = await appDb();
  const rows = await db<{ email: string }[]>`UPDATE kl_invites SET revoked_at = now()
    WHERE id = ${inviteId} AND org_id = ${orgId} AND accepted_at IS NULL AND revoked_at IS NULL RETURNING email`;
  if (rows[0]) await audit(orgId, actor, "invite.revoked", rows[0].email);
}

export interface InviteView {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  role: Role;
}

export async function getInvite(token: string): Promise<InviteView | null> {
  const db = await appDb();
  const [i] = await db<InviteView[]>`
    SELECT i.id, i.org_id AS "orgId", o.name AS "orgName", i.email, i.role
    FROM kl_invites i JOIN kl_organisations o ON o.id = i.org_id
    WHERE i.token_hash = ${hashToken(token)} AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()`;
  return i ?? null;
}

export async function acceptInvite(token: string, user: AppUser, name: unknown, title: unknown): Promise<string> {
  const invite = await getInvite(token);
  if (!invite) throw new AppError("This invite has expired or has already been used.");
  if (invite.email !== user.email) throw new AppError(`This invite is for ${invite.email}. Sign in with that address to accept it.`);
  if (await closingDate(invite.orgId)) throw new AppError(`${invite.orgName} is closing, so it isn't accepting new members.`);
  await saveProfile(user, name, title);
  const db = await appDb();
  await db.begin(async (tx) => {
    await tx`INSERT INTO kl_members (org_id, user_id, email, role) VALUES (${invite.orgId}, ${user.id}, ${user.email}, ${invite.role})
             ON CONFLICT (org_id, user_id) DO NOTHING`;
    await tx`UPDATE kl_invites SET accepted_at = now() WHERE id = ${invite.id}`;
  });
  await audit(invite.orgId, user, "invite.accepted", user.email, { role: invite.role });
  return invite.orgId;
}

/** Only people with an account, a pending invite or admin rights are sent a sign-in link. */
export async function mayRequestSignIn(email: string): Promise<boolean> {
  if (isAdmin(email)) return true;
  const db = await appDb();
  const [row] = await db`
    SELECT 1 FROM kl_members WHERE email = ${email}
    UNION ALL
    SELECT 1 FROM kl_invites WHERE email = ${email} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    LIMIT 1`;
  return Boolean(row);
}

// ---------- Admin: setting up design partners ----------

export interface OrgSummary {
  id: string;
  name: string;
  members: number;
  pendingInvites: number;
  createdAt: Date;
  /** When the first owner joined, and when the first record was started and locked. For measuring onboarding. */
  ownerJoinedAt: Date | null;
  firstRecordAt: Date | null;
  firstLockAt: Date | null;
  remindedAt: Date | null;
  deleteAfter: Date | null;
}

export async function listOrganisations(): Promise<OrgSummary[]> {
  const db = await appDb();
  return db<OrgSummary[]>`
    SELECT o.id, o.name, o.created_at AS "createdAt",
      (SELECT count(*)::int FROM kl_members m WHERE m.org_id = o.id) AS members,
      (SELECT count(*)::int FROM kl_invites i WHERE i.org_id = o.id AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()) AS "pendingInvites",
      (SELECT min(m.created_at) FROM kl_members m WHERE m.org_id = o.id AND m.role = 'owner') AS "ownerJoinedAt",
      (SELECT min(a.at) FROM kl_audit a WHERE a.org_id = o.id AND a.action = 'record.created') AS "firstRecordAt",
      (SELECT min(a.at) FROM kl_audit a WHERE a.org_id = o.id AND a.action = 'record.locked' AND a.detail->>'kind' = 'requirements') AS "firstLockAt",
      o.onboarding_reminded_at AS "remindedAt", o.delete_after AS "deleteAfter"
    FROM kl_organisations o ORDER BY o.created_at DESC`;
}

export async function createOrganisation(admin: AppUser, nameRaw: unknown, ownerEmailRaw: unknown) {
  if (!isAdmin(admin.email)) throw new AppError("You don't have permission to do that.");
  const name = typeof nameRaw === "string" ? nameRaw.trim().slice(0, 80) : "";
  if (!name) throw new AppError("Enter the organisation's name.");
  const ownerEmail = checkEmail(ownerEmailRaw);
  const db = await appDb();
  const orgId = newId("org");
  await db`INSERT INTO kl_organisations (id, name) VALUES (${orgId}, ${name})`;
  await audit(orgId, admin, "org.created", name);
  const { token } = await insertInvite(orgId, admin, ownerEmail, "owner");
  return { orgId, name, ownerEmail, token };
}
