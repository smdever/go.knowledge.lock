import { deleteSignInAccount, type AppUser } from "./auth";
import { appDb } from "./db";
import { noticeEmail, sendEmail } from "./email";
import { AppError, audit, ownerCount } from "./orgs";

/**
 * A person's own data rights: download everything held about them, leave an organisation, and delete
 * their account. Records their organisation has locked keep their sign-offs: those belong to the
 * organisation, and are what it relies on.
 */

const iso = (d: Date | number | null | undefined) => (d ? new Date(d).toISOString() : null);

// ---------- Download my data ----------

export async function exportMyData(user: AppUser) {
  const db = await appDb();
  const role = `user:${user.id}`;
  const [profile] = await db<{ name: string; title: string; slackMemberId: string | null; updatedAt: Date }[]>`
    SELECT name, title, slack_member_id AS "slackMemberId", updated_at AS "updatedAt" FROM kl_profiles WHERE user_id = ${user.id}`;
  const memberships = await db<{ organisation: string; role: string; joinedAt: Date }[]>`
    SELECT o.name AS organisation, m.role, m.created_at AS "joinedAt"
    FROM kl_members m JOIN kl_organisations o ON o.id = m.org_id WHERE m.user_id = ${user.id} ORDER BY o.name`;
  const passkeys = await db<{ name: string; createdAt: Date; lastUsedAt: Date | null; synced: boolean; removedAt: Date | null }[]>`
    SELECT name, created_at AS "createdAt", last_used_at AS "lastUsedAt", synced, removed_at AS "removedAt"
    FROM kl_passkeys WHERE user_id = ${user.id} ORDER BY created_at`;
  const signed = await db<{ organisation: string; data: Record<string, unknown> & { attestations: Record<string, unknown>[] } }[]>`
    SELECT o.name AS organisation, r.data FROM kl_app_records r JOIN kl_organisations o ON o.id = r.org_id
    WHERE r.data->'attestations' @> ${db.json([{ role }] as never)} ORDER BY r.updated_at`;
  const created = await db<{ organisation: string; title: string; kind: string; version: number; status: string; lockId: string | null; createdAt: Date }[]>`
    SELECT o.name AS organisation, r.data->'payload'->>'title' AS title, r.kind, (r.data->>'version')::int AS version, r.status,
      r.lock_id AS "lockId", r.created_at AS "createdAt"
    FROM kl_app_records r JOIN kl_organisations o ON o.id = r.org_id WHERE r.created_by = ${user.id} ORDER BY r.created_at`;
  const activity = await db<{ at: Date; organisation: string | null; action: string; target: string | null; detail: unknown }[]>`
    SELECT a.at, o.name AS organisation, a.action, a.target, a.detail
    FROM kl_audit a LEFT JOIN kl_organisations o ON o.id = a.org_id WHERE a.actor_id = ${user.id} ORDER BY a.at`;
  const invites = await db<{ organisation: string; role: string; sentAt: Date; acceptedAt: Date | null }[]>`
    SELECT o.name AS organisation, i.role, i.created_at AS "sentAt", i.accepted_at AS "acceptedAt"
    FROM kl_invites i JOIN kl_organisations o ON o.id = i.org_id WHERE i.email = ${user.email} ORDER BY i.created_at`;
  const requests = await db<{ name: string; company: string; title: string; message: string; status: string; createdAt: Date }[]>`
    SELECT name, company, title, message, status, created_at AS "createdAt" FROM kl_access_requests WHERE email = ${user.email} ORDER BY created_at`;
  const keys = await db<{ organisation: string; name: string; createdAt: Date; revokedAt: Date | null }[]>`
    SELECT o.name AS organisation, k.name, k.created_at AS "createdAt", k.revoked_at AS "revokedAt"
    FROM kl_api_keys k JOIN kl_organisations o ON o.id = k.org_id WHERE k.created_by = ${user.id}`;
  const channels = await db<{ organisation: string; kind: string; name: string; createdAt: Date }[]>`
    SELECT o.name AS organisation, c.kind, c.name, c.created_at AS "createdAt"
    FROM kl_channels c JOIN kl_organisations o ON o.id = c.org_id WHERE c.created_by = ${user.id}`;

  return {
    about:
      "Everything Knowledge Lock holds about you, as of exportedAt. Records your organisations locked also contain your sign-offs; they are listed under signOffs.",
    exportedAt: new Date().toISOString(),
    account: { userId: user.id, email: user.email },
    profile: profile ? { ...profile, updatedAt: iso(profile.updatedAt) } : null,
    memberships: memberships.map((m) => ({ ...m, joinedAt: iso(m.joinedAt) })),
    passkeys: passkeys.map((k) => ({
      name: k.name,
      addedAt: iso(k.createdAt),
      lastUsedAt: iso(k.lastUsedAt),
      availableOnOtherDevices: k.synced,
      removedAt: iso(k.removedAt),
      note: "Only the public half of a passkey is stored.",
    })),
    signOffs: signed.flatMap(({ organisation, data }) =>
      data.attestations
        .filter((a) => a.role === role)
        .map((a) => ({
          organisation,
          record: (data.payload as { title?: string })?.title ?? "",
          version: data.version,
          status: data.status,
          lockId: data.lockId ?? null,
          decision: a.decision === "APPROVE" ? "approved" : "asked for changes",
          comment: a.reasoning ?? null,
          signedAt: iso(a.timestamp as number),
          signedAs: a.attestorId,
          signedWithPasskey: Boolean(a.personalSignature),
        }))
    ),
    recordsCreated: created.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
    activity: activity.map((a) => ({ ...a, at: iso(a.at) })),
    invitesReceived: invites.map((i) => ({ ...i, sentAt: iso(i.sentAt), acceptedAt: iso(i.acceptedAt) })),
    accessRequests: requests.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
    apiKeysCreated: keys.map((k) => ({ ...k, createdAt: iso(k.createdAt), revokedAt: iso(k.revokedAt) })),
    channelsConnected: channels.map((c) => ({ ...c, createdAt: iso(c.createdAt) })),
    notHere: [
      "Sign-in links and notices we emailed you: our email provider keeps them for up to 30 days.",
      "Your IP address: we only keep a scrambled form, for rate limits and to protect forms from abuse. It can't be linked back to you.",
    ],
  };
}

// ---------- Leaving and deleting ----------

/** Organisations where this person is the only owner (and that aren't already closing). */
export async function soleOwnerOf(userId: string): Promise<string[]> {
  const db = await appDb();
  const rows = await db<{ name: string }[]>`
    SELECT o.name FROM kl_members m JOIN kl_organisations o ON o.id = m.org_id
    WHERE m.user_id = ${userId} AND m.role = 'owner' AND o.closing_at IS NULL
      AND (SELECT count(*) FROM kl_members x WHERE x.org_id = m.org_id AND x.role = 'owner') = 1
    ORDER BY o.name`;
  return rows.map((r) => r.name);
}

export async function leaveOrganisation(orgId: string, user: AppUser): Promise<string> {
  const db = await appDb();
  const [m] = await db<{ role: string; name: string; closing: boolean }[]>`
    SELECT m.role, o.name, o.closing_at IS NOT NULL AS closing FROM kl_members m JOIN kl_organisations o ON o.id = m.org_id
    WHERE m.org_id = ${orgId} AND m.user_id = ${user.id}`;
  if (!m) throw new AppError("You're not in that organisation.");
  if (m.role === "owner" && !m.closing && (await ownerCount(orgId)) <= 1) {
    throw new AppError(`You're the only owner of ${m.name}. Make someone else an owner first, or close the organisation.`);
  }
  await db`DELETE FROM kl_members WHERE org_id = ${orgId} AND user_id = ${user.id}`;
  await audit(orgId, user, "member.left", user.email);
  return m.name;
}

/** Removes what's held about a person outside their organisations' records, and their sign-in account. */
export async function eraseAccountData(userId: string, email: string): Promise<void> {
  const db = await appDb();
  await db`DELETE FROM kl_passkeys WHERE user_id = ${userId}`;
  await db`DELETE FROM kl_passkey_challenges WHERE user_id = ${userId}`;
  await db`DELETE FROM kl_profiles WHERE user_id = ${userId}`;
  if (!(await deleteSignInAccount(userId)) && !userId.startsWith("dev_")) {
    // Without SUPABASE_SECRET_KEY, ask an admin to remove the sign-in account by hand.
    const admins = (process.env.KL_SUPPORT_EMAIL || process.env.KL_ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
    const lines = [
      `${email} deleted their Knowledge Lock account, but their sign-in account couldn't be removed automatically.`,
      `In Supabase, open Authentication, then Users, find ${email} (user id ${userId}) and delete it.`,
    ];
    for (const to of admins) {
      await sendEmail(to, `Delete a sign-in account: ${email}`, `<p>${lines.join("</p><p>")}</p>`, lines.join("\n\n")).catch(() => {});
    }
  }
}

/**
 * Deletes the person's account: they leave every organisation, and their profile, passkeys and sign-in
 * account are deleted. The only owner of an organisation has to hand it over or close it first.
 */
export async function deleteAccount(user: AppUser, confirmRaw: unknown): Promise<void> {
  const confirm = typeof confirmRaw === "string" ? confirmRaw.trim().toLowerCase() : "";
  if (confirm !== user.email.toLowerCase()) throw new AppError(`Type your email address, ${user.email}, to confirm.`);
  const sole = await soleOwnerOf(user.id);
  if (sole.length) {
    throw new AppError(
      `You're the only owner of ${sole.join(" and ")}. Make someone else an owner, or close the organisation, before deleting your account.`
    );
  }
  const db = await appDb();
  const orgs = await db<{ orgId: string }[]>`SELECT org_id AS "orgId" FROM kl_members WHERE user_id = ${user.id}`;
  for (const { orgId } of orgs) {
    await db`DELETE FROM kl_members WHERE org_id = ${orgId} AND user_id = ${user.id}`;
    await audit(orgId, user, "member.left", user.email, { accountDeleted: true });
  }
  await eraseAccountData(user.id, user.email);
  const mail = noticeEmail({
    orgName: "Guided Orchestration",
    subject: "Your Knowledge Lock account has been deleted",
    heading: "Your account has been deleted",
    lines: [
      "You've left every organisation, and your profile, passkeys and sign-in account have been deleted.",
      "Records your organisations locked keep your sign-offs, because those records belong to them. To ask about them, contact the organisation, or email privacy@guidedorchestration.com.",
    ],
    cta: "Read our privacy notice",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com"}/privacy`,
    footer: "Knowledge Lock, by Guided Orchestration Ltd. This is the last email you'll get about this account.",
  });
  await sendEmail(user.email, mail.subject, mail.html, mail.text).catch(() => {});
}
