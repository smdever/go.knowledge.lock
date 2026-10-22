import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { InviteForm, RemoveForm, RoleForm } from "@/components/app/forms";
import { changeRoleAction, inviteAction, removeMemberAction, revokeInviteAction } from "@/app/app/actions";
import { getContext } from "@/lib/app/context";
import { listInvites, listMembers } from "@/lib/app/orgs";
import { ROLE_HELP, ROLE_LABEL, ROLES } from "@/lib/app/roles";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function TeamPage() {
  const ctx = await getContext("/app/team");
  if (!ctx.current) redirect("/app");
  const org = ctx.current;
  const owner = org.role === "owner";
  const [members, invites] = await Promise.all([listMembers(org.orgId), listInvites(org.orgId)]);

  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold text-accent">{org.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Team</h1>

      {owner ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Invite someone</h2>
          <p className="mt-1 text-sm text-ink/65">They&apos;ll get an email with a link that works for 7 days.</p>
          <div className="mt-4">
            <InviteForm action={inviteAction} />
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">People ({members.length})</h2>
        <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {members.map((m) => {
            const me = m.userId === ctx.user.id;
            return (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.name || m.email} size={36} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {m.name || m.email} {me ? <span className="text-xs font-normal text-muted">(you)</span> : null}
                    </p>
                    <p className="truncate text-sm text-ink/60">
                      {[m.title, m.email].filter(Boolean).join(" · ")} · joined {fmt(m.joinedAt)}
                    </p>
                  </div>
                </div>
                {owner ? (
                  <div className="flex items-center gap-4">
                    <RoleForm action={changeRoleAction} userId={m.userId} role={m.role} />
                    {!me ? <RemoveForm action={removeMemberAction} userId={m.userId} label={m.name || m.email} /> : null}
                  </div>
                ) : (
                  <span className="text-sm text-ink/70">{ROLE_LABEL[m.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {owner && invites.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Pending invites ({invites.length})</h2>
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-semibold">{i.email}</span>
                  <span className="text-ink/60"> · {ROLE_LABEL[i.role]} · expires {fmt(i.expiresAt)}</span>
                </span>
                <form action={revokeInviteAction}>
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button type="submit" className="text-xs text-muted hover:text-bad">Cancel invite</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Roles</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r} className="rounded-xl border border-ink/10 p-4">
              <dt className="font-semibold">{ROLE_LABEL[r]}</dt>
              <dd className="mt-1 text-ink/70">Can {ROLE_HELP[r]}.</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
