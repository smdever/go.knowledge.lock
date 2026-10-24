import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { Download } from "lucide-react";
import { CancelClosureForm, CloseOrgForm, InviteForm, RemoveForm, RequirePasskeysForm, RoleForm } from "@/components/app/forms";
import {
  cancelClosureAction,
  changeRoleAction,
  closeOrgAction,
  inviteAction,
  removeMemberAction,
  revokeInviteAction,
  setRequirePasskeysAction,
} from "@/app/app/actions";
import { GRACE_DAYS } from "@/lib/app/closure";
import { getContext } from "@/lib/app/context";
import { listInvites, listMembers, longDate, requiresPasskeys } from "@/lib/app/orgs";
import { usersWithPasskeys } from "@/lib/app/passkeys";
import { ROLE_HELP, ROLE_LABEL, ROLES } from "@/lib/app/roles";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function TeamPage() {
  const ctx = await getContext("/app/team");
  if (!ctx.current) redirect("/app");
  const org = ctx.current;
  const owner = org.role === "owner";
  const closing = org.closing;
  const [members, invites, required] = await Promise.all([listMembers(org.orgId), listInvites(org.orgId), requiresPasskeys(org.orgId)]);
  const withKeys = await usersWithPasskeys(members.map((m) => m.userId));

  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold text-accent">{org.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Team</h1>

      {owner && !closing ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Invite someone</h2>
          <p className="mt-1 text-sm text-ink/70">They&apos;ll get an email with a link that works for 7 days.</p>
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
                    <p className="truncate text-sm text-ink/70">
                      {[m.title, m.email].filter(Boolean).join(" · ")} · joined {fmt(m.joinedAt)}
                      {m.role !== "viewer" ? (withKeys.has(m.userId) ? " · has a passkey" : " · no passkey yet") : ""}
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
                  <span className="text-ink/70"> · {ROLE_LABEL[i.role]} · expires {fmt(i.expiresAt)}</span>
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

      {owner && !closing ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Personal signatures</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink/70">
            Anyone with a passkey already signs their sign-offs with it. You can make it a rule, so a sign-off only counts when it is
            signed on the person&apos;s own device.
          </p>
          <div className="mt-4 max-w-2xl">
            <RequirePasskeysForm action={setRequirePasskeysAction} on={required} />
          </div>
        </section>
      ) : null}

      {owner ? (
        <section className="mt-10" id="data">
          <h2 className="text-lg font-semibold">Download everything</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink/70">
            Every locked record with its signatures and verification result, every draft, the people here and the full activity
            log, as a JSON file. Locked records can be re-checked without us.
          </p>
          <a
            href={`/api/app/org/export?org=${org.orgId}`}
            download
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold hover:border-ink/40"
          >
            <Download className="h-4 w-4" /> Download everything
          </a>
        </section>
      ) : null}

      {owner ? (
        <section className="mt-10" id="close">
          {closing ? (
            <>
              <h2 className="text-lg font-semibold">{org.orgName} is closing</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
                {closing.by} asked to close it. On {longDate(closing.deleteAfter)}, everything in it will be permanently deleted,
                including locked records and the activity log. Download everything first if you need to keep it.
              </p>
              <div className="mt-4">
                <CancelClosureForm action={cancelClosureAction} />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Close the organisation</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/70">
                Closing makes {org.orgName} read-only straight away and switches off the API, Jira and Slack or Teams. After{" "}
                {GRACE_DAYS} days, everything in it is permanently deleted, including locked records and the activity log, along with
                the accounts of people who aren&apos;t in another organisation. Any owner can cancel until then.
              </p>
              <div className="mt-4">
                <CloseOrgForm action={closeOrgAction} orgName={org.orgName} days={GRACE_DAYS} />
              </div>
            </>
          )}
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
