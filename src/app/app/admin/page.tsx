import { notFound } from "next/navigation";
import { AccessRequests, CreateOrgForm } from "@/components/app/forms";
import { approveAccessAction, createOrgAction, dismissAccessAction } from "@/app/app/actions";
import { listAccessRequests } from "@/lib/app/access";
import { getContext } from "@/lib/app/context";
import { listOrganisations } from "@/lib/app/orgs";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);

/** How long after the owner joined something happened: "3 hours", "2 days". */
function after(from: Date | null, to: Date | null): string {
  if (!to) return "Not yet";
  if (!from) return fmt(to);
  const hours = Math.max(0, (to.getTime() - from.getTime()) / 36e5);
  if (hours < 1) return "Within an hour";
  if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

export default async function AdminPage() {
  const ctx = await getContext("/app/admin");
  if (!ctx.admin) notFound();
  const [orgs, requests] = await Promise.all([listOrganisations(), listAccessRequests()]);
  return (
    <div className="max-w-5xl">
      <p className="text-sm font-semibold text-accent">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Design partners</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink/70">
        Create an organisation for each design partner and invite its owner. They invite the rest of their team. First record
        and first lock show how long after the owner joined each happened.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Access requests ({requests.length})</h2>
        <AccessRequests
          approve={approveAccessAction}
          dismiss={dismissAccessAction}
          requests={requests.map((r) => ({ ...r, created: fmt(r.createdAt) }))}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Create an organisation</h2>
        <div className="mt-4">
          <CreateOrgForm action={createOrgAction} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Organisations ({orgs.length})</h2>
        {orgs.length ? (
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-ink/70">
              <tr className="border-b border-ink/10">
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold">People</th>
                <th className="py-2 font-semibold">Pending invites</th>
                <th className="py-2 font-semibold">Created</th>
                <th className="py-2 font-semibold">First record</th>
                <th className="py-2 font-semibold">First lock</th>
                <th className="py-2 font-semibold">Reminder</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-ink/10">
                  <td className="py-2.5 font-semibold">{o.name}</td>
                  <td className="py-2.5">{o.members}</td>
                  <td className="py-2.5">{o.pendingInvites}</td>
                  <td className="py-2.5">{fmt(o.createdAt)}</td>
                  <td className="py-2.5">{o.ownerJoinedAt ? after(o.ownerJoinedAt, o.firstRecordAt) : "Owner not joined"}</td>
                  <td className="py-2.5">{o.ownerJoinedAt ? after(o.ownerJoinedAt, o.firstLockAt) : ""}</td>
                  <td className="py-2.5">{o.remindedAt ? fmt(o.remindedAt) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/70">None yet.</p>
        )}
      </section>
    </div>
  );
}
