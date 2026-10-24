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
      case "passkey.added":
        return { ...base, text: `added a passkey (${r.target})` };
      case "passkey.removed":
        return { ...base, text: `removed a passkey (${r.target})` };
      case "org.passkeys_required":
        return { ...base, text: "made passkeys required for sign-offs on new records" };
      case "org.passkeys_optional":
        return { ...base, text: "made passkeys optional for sign-offs on new records" };
      case "access_request.approved":
        return { ...base, text: `approved ${r.target}'s request for access` };
      case "jira.connected":
        return { ...base, text: `connected Jira (${String(r.target).replace(/^https?:\/\//, "")})` };
      case "jira.disconnected":
        return { ...base, text: "disconnected Jira" };
      case "jira.checked": {
        const result = d.status === "clear" ? "matches" : d.status === "departs" ? "departs from what was agreed" : "adds things not agreed";
        return { ...base, text: `${d.auto ? "re-checked" : "checked"} Jira issue ${r.target}: ${result}`, ...(!r.actorName && !r.actorEmail ? { actor: "Jira" } : {}) };
      }
      case "jira.issues_created":
        return { ...base, text: `created ${Array.isArray(d.issues) ? d.issues.length : ""} Jira issues in ${r.target}`, note: Array.isArray(d.issues) ? d.issues.join(", ") : undefined };
      case "jira.unlinked":
        return { ...base, text: `unlinked Jira issue ${r.target}` };
      case "channel.added":
        return { ...base, text: `connected the ${d.kind === "teams" ? "Teams" : "Slack"} channel "${r.target}"` };
      case "channel.removed":
        return { ...base, text: `disconnected the ${d.kind === "teams" ? "Teams" : "Slack"} channel "${r.target}"` };
      case "api_key.created":
        return { ...base, text: `created the API key "${r.target}"` };
      case "api_key.revoked":
        return { ...base, text: `revoked the API key "${r.target}"` };
      case "api.export":
        return { ...base, actor: `API key "${String(d.key ?? "")}"`, text: "exported all locked records" };
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
        return { ...base, text: `signed off ${record}${v}${d.passkey ? " with their passkey" : ""}`, href: recordHref };
      case "record.objected":
        return { ...base, text: `asked for changes to ${record}${v}${d.passkey ? ", signed with their passkey" : ""}`, note: d.comment ? `"${d.comment}"` : undefined, href: recordHref };
      case "record.locked":
        return { ...base, text: `locked ${record}${v}`, href: typeof d.lockId === "string" ? `/app/l/${d.lockId}` : recordHref };
      case "record.archived":
        return { ...base, text: `archived the draft ${record}${v}`, href: recordHref };
      case "record.unarchived":
        return { ...base, text: `restored the draft ${record}${v}`, href: recordHref };
      case "record.retired":
        return {
          ...base,
          text: `retired ${record}${v}`,
          note: [d.reason ? `"${d.reason}"` : "", d.draftsArchived ? `The draft of the next version was archived too.` : ""].filter(Boolean).join(" ") || undefined,
          href: typeof d.lockId === "string" ? `/app/l/${d.lockId}` : recordHref,
        };
      case "record.restored":
        return { ...base, text: `restored ${record}${v}, so it's in use again`, href: typeof d.lockId === "string" ? `/app/l/${d.lockId}` : recordHref };
      default:
        return { ...base, text: r.action };
    }
  });
}
