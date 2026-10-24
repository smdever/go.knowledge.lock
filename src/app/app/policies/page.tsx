import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { getContext } from "@/lib/app/context";
import { appDb } from "@/lib/app/db";
import { listRecords, policyClaimsFor } from "@/lib/app/records";

export default async function PoliciesPage() {
  const ctx = await getContext("/app/policies");
  if (!ctx.current) redirect("/app");
  const org = ctx.current;
  const db = await appDb();
  const [row] = await db<{ policyLockId: string | null }[]>`SELECT policy_lock_id AS "policyLockId" FROM kl_organisations WHERE id = ${org.orgId}`;
  const policyLockId = row?.policyLockId ?? null;
  const claims = await policyClaimsFor(org.orgId, policyLockId);
  const drafts = (await listRecords(org.orgId, ctx.user.id)).filter((r) => r.kind === "policy" && r.status === "draft");
  const owner = org.role === "owner";

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">{org.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Policy</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        The rules every record is checked against. The AI reviewers flag anything that conflicts with them, and nothing that
        conflicts can be locked.
      </p>

      {drafts.length ? (
        <div className="mt-6 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="font-semibold">A policy change is in progress</p>
          {drafts.map((d) => (
            <Link key={d.id} href={`/app/r/${d.id}`} className="mt-1 inline-flex items-center gap-1 text-steel hover:text-ink">
              {d.title}, draft v{d.version} ({d.approvals} of {d.quorum} approvals) <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      ) : null}

      {policyLockId ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
              <Lock className="h-4 w-4" /> Locked policy
            </p>
            <Link href={`/app/l/${policyLockId}`} className="text-sm font-semibold text-steel hover:text-ink">
              Who agreed it, verify it{owner ? ", or propose a change" : ""}
            </Link>
          </div>
          <ol className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {claims.map((c) => (
              <li key={c.id} className="flex gap-3 py-3 text-[15px] leading-relaxed">
                <span className="w-7 shrink-0 text-sm font-semibold text-steel">{c.id}</span>
                <span>{c.statement}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-ink/10 p-6">
          <h2 className="font-semibold">No policy locked yet</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            Until there is one, the AI reviewers check records for contradictions and unclear wording only.
          </p>
          {owner && !drafts.length ? (
            <Link
              href="/app/records/new?kind=policy"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              Propose the policy <ArrowRight className="h-4 w-4" />
            </Link>
          ) : !owner ? (
            <p className="mt-3 text-sm text-muted">An owner can propose it.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
