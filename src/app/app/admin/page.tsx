import { notFound } from "next/navigation";
import { CreateOrgForm } from "@/components/app/forms";
import { createOrgAction } from "@/app/app/actions";
import { getContext } from "@/lib/app/context";
import { listOrganisations } from "@/lib/app/orgs";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function AdminPage() {
  const ctx = await getContext("/app/admin");
  if (!ctx.admin) notFound();
  const orgs = await listOrganisations();
  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold text-accent">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Design partners</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink/70">
        Create an organisation for each design partner and invite its owner. They invite the rest of their team.
      </p>

      <section className="mt-8">
        <CreateOrgForm action={createOrgAction} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Organisations ({orgs.length})</h2>
        {orgs.length ? (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-ink/60">
              <tr className="border-b border-ink/10">
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold">People</th>
                <th className="py-2 font-semibold">Pending invites</th>
                <th className="py-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-ink/10">
                  <td className="py-2.5 font-semibold">{o.name}</td>
                  <td className="py-2.5">{o.members}</td>
                  <td className="py-2.5">{o.pendingInvites}</td>
                  <td className="py-2.5">{fmt(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-ink/65">None yet.</p>
        )}
      </section>
    </div>
  );
}
