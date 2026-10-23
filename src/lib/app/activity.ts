import { appDb } from "./db";
import { ROLE_LABEL, type Role } from "./roles";

export interface ActivityItem {
  id: string;
  at: Date;
  actor: string;
  text: string;
  href?: string;
  note?: string;
}

interface Row {
  id: string;
  at: Date;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  actorName: string | null;
  actorEmail: string | null;
  title: string | null;
  lockId: string | null;
  kind: string | null;
}

const roleName = (r: unknown) => (typeof r === "string" && r in ROLE_LABEL ? ROLE_LABEL[r as Role].toLowerCase() : String(r ?? ""));

/** The organisation's audit log, newest first, in plain words. The log itself is append-only. */
export async function listActivity(orgId: string, limit = 200): Promise<ActivityItem[]> {
  const db = await appDb();
  const rows = await db<Row[]>`
    SELECT a.id::text AS id, a.at, a.action, a.target, a.detail,
      p.name AS "actorName", a.actor_email AS "actorEmail",
      r.data->'payload'->>'title' AS title, r.lock_id AS "lockId", r.kind
    FROM kl_audit a
    LEFT JOIN kl_profiles p ON p.user_id = a.actor_id
    LEFT JOIN kl_app_records r ON r.id = a.target
    WHERE a.org_id = ${orgId}
    ORDER BY a.at DESC, a.id DESC
    LIMIT ${limit}`;
  return rows.map((r) => {
    const d = r.detail ?? {};
    const record = r.title ? `"${r.title}"` : "a record";
    const v = d.version ? ` v${d.version}` : "";
    const recordHref = r.target && r.title ? `/app/r/${r.target}` : undefined;
    const base = { id: r.id, at: r.at, actor: r.actorName || r.actorEmail || "Guided Orchestration" };
    switch (r.action) {
      case "org.created":
        return { ...base, text: "created the organisation" };
      case "invite.created":
        return { ...base, text: `invited ${r.target} as ${roleName(d.role) === "owner" ? "an owner" : `a ${roleName(d.role)}`}` };
      case "invite.revoked":
        return { ...base, text: `cancelled the invite for ${r.target}` };
      case "invite.accepted":
        return { ...base, text: `joined as ${roleName(d.role) === "owner" ? "an owner" : `a ${roleName(d.role)}`}` };
      case "member.role_changed":
        return { ...base, text: `changed ${r.target}'s role from ${roleName(d.from)} to ${roleName(d.to)}` };
      case "member.removed":
        return { ...base, text: `removed ${r.target}` };
      case "record.created":
        return { ...base, text: `created ${record}${v}`, href: recordHref };
      case "record.reviewed":
        return {
          ...base,
          text: `sent ${record}${v} for AI review`,
          note: d.objections ? `${d.objections} reviewer${d.objections === 1 ? "" : "s"} objected` : "No objections",
          href: recordHref,
        };
      case "record.approved":
        return { ...base, text: `signed off ${record}${v}`, href: recordHref };
      case "record.objected":
        return { ...base, text: `asked for changes to ${record}${v}`, note: d.comment ? `"${d.comment}"` : undefined, href: recordHref };
      case "record.locked":
        return { ...base, text: `locked ${record}${v}`, href: typeof d.lockId === "string" ? `/app/l/${d.lockId}` : recordHref };
      default:
        return { ...base, text: r.action };
    }
  });
}
