import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive } from "lucide-react";
import Workspace from "@/components/Workspace";
import { ProductMode } from "@/components/KLContext";
import { ArchiveDraftButton } from "@/components/app/RetireControls";
import { getContext } from "@/lib/app/context";
import { DemoError } from "@/lib/demo/service";
import { policyClaimsFor, recordFor, viewFor, type AppRecord } from "@/lib/app/records";

const fmtDay = (ms: number) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(ms);

export default async function ProductRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getContext(`/app/r/${id}`);
  let found;
  try {
    found = await recordFor(user, id, "read");
  } catch (err) {
    if (err instanceof DemoError && err.status === 404) notFound();
    throw err;
  }
  const { record, role } = found;
  if (record.status === "draft" && record.archived) {
    return <ArchivedDraft record={record} canRestore={role === "owner" || record.createdBy === user.id} />;
  }
  const view = await viewFor(record, user, role);
  const policy = record.kind === "policy" ? [] : await policyClaimsFor(record.orgId, record.payload.metadata?.policyLockId as string);
  return (
    <ProductMode>
      <Workspace initial={view} policy={policy} />
    </ProductMode>
  );
}

/** An archived draft: read only, with a way back for its creator or an owner. */
function ArchivedDraft({ record, canRestore }: { record: AppRecord; canRestore: boolean }) {
  const a = record.archived!;
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">{record.payload.title}</p>
        <p className="text-sm text-muted">Draft v{record.version}</p>
      </div>
      <div role="status" className="mt-6 rounded-lg border border-warn/50 bg-surface px-4 py-3 text-sm leading-relaxed">
        <p className="flex items-center gap-2 font-semibold text-warn">
          <Archive className="h-4 w-4 shrink-0" /> Archived on {fmtDay(a.at)} by {a.byName}
        </p>
        <p className="mt-1 text-ink/80">
          {a.because === "retired"
            ? "It was archived because the record it changes was retired. Nothing can be reviewed, signed or locked while it's archived."
            : "Nothing can be reviewed, signed or locked while it's archived."}
          {canRestore ? " Restore it to carry on where you left off." : " The person who started it, or an owner, can restore it."}
        </p>
        {canRestore ? (
          <div className="mt-3">
            <ArchiveDraftButton recordId={record.id} archived />
          </div>
        ) : null}
      </div>
      <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{record.payload.title}</h1>
      <ol className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
        {record.payload.claims.map((c) => (
          <li key={c.id} className="flex gap-3 py-3 text-[15px] leading-relaxed">
            <span className="w-7 shrink-0 text-sm font-semibold text-steel">{c.id}</span>
            <span>{c.statement}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm">
        <Link href="/app" className="font-semibold text-steel hover:text-ink">
          Back to records
        </Link>
      </p>
    </div>
  );
}
