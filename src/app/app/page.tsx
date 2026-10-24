import Link from "next/link";
import { Archive, ArrowRight, Check, ChevronDown, FileText, Lock, Plus, ShieldCheck } from "lucide-react";
import { getContext } from "@/lib/app/context";
import { listRecords, type RecordSummary } from "@/lib/app/records";
import { ROLE_HELP, withArticle } from "@/lib/app/roles";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

function Row({ r }: { r: RecordSummary }) {
  const href = r.status === "locked" && r.lockId ? `/app/l/${r.lockId}` : `/app/r/${r.id}`;
  return (
    <li>
      <Link href={href} className="group flex items-center justify-between gap-4 py-3.5">
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-semibold group-hover:underline">
            {r.kind === "policy" ? <ShieldCheck className="h-4 w-4 shrink-0 text-steel" /> : <FileText className="h-4 w-4 shrink-0 text-steel" />}
            <span className="truncate">{r.title}</span>
          </span>
          <span className="mt-0.5 block text-sm text-ink/70">
            v{r.version} ·{" "}
            {r.status === "locked"
              ? r.superseded
                ? "replaced by a newer version"
                : r.retired
                  ? "retired"
                  : "locked"
              : r.archived
                ? "archived draft"
                : `${r.approvals} of ${r.quorum} approvals`}{" "}
            · {fmt(r.updatedAt)}
          </span>
        </span>
        {r.archived || r.retired ? (
          <Archive className="h-4 w-4 shrink-0 text-ink/70" />
        ) : r.status === "locked" ? (
          <Lock className="h-4 w-4 shrink-0 text-good" />
        ) : r.waitingOnMe ? (
          <span className="shrink-0 rounded-full bg-accent/[0.06] px-2.5 py-1 text-xs font-semibold text-accent">Needs you</span>
        ) : (
          <ArrowRight className="h-4 w-4 shrink-0 text-ink/70" />
        )}
      </Link>
    </li>
  );
}

function Section({ title, records, empty }: { title: string; records: RecordSummary[]; empty?: string }) {
  if (!records.length && !empty) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {records.length ? (
        <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
          {records.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink/70">{empty}</p>
      )}
    </section>
  );
}

export default async function AppHome() {
  const ctx = await getContext();
  const first = ctx.profile?.name?.split(" ")[0];

  if (!ctx.current)
    return (
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{first ? `Welcome, ${first}` : "Welcome"}</h1>
        {ctx.admin ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
              You&apos;re not in an organisation yet. Set up your first design partner and invite its owner.
            </p>
            <Link href="/app/admin" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              Set up an organisation <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
            You&apos;re signed in as {ctx.user.email}, but you&apos;re not in an organisation yet. Ask the person who invited
            you to send a new invite.
          </p>
        )}
      </section>
    );

  const org = ctx.current;
  const records = await listRecords(org.orgId, ctx.user.id);
  const waiting = records.filter((r) => r.waitingOnMe);
  const drafts = records.filter((r) => r.status === "draft" && !r.waitingOnMe && !r.archived);
  const locked = records.filter((r) => r.status === "locked" && !r.superseded && !r.retired);
  const archived = records.filter((r) => r.archived || (r.retired && !r.superseded));
  const canCreate = org.role !== "viewer";

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">{org.orgName}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{first ? `Welcome, ${first}` : "Welcome"}</h1>
        {canCreate ? (
          <Link href="/app/records/new" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <Plus className="h-4 w-4" /> New record
          </Link>
        ) : null}
      </div>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/75">
        You&apos;re {withArticle(org.role)} here, so you can {ROLE_HELP[org.role]}.
      </p>
      {!ctx.profile ? (
        <p className="mt-4 text-sm">
          <Link href="/app/profile" className="font-semibold text-accent hover:underline">Add your name and job title</Link>{" "}
          <span className="text-ink/70">so colleagues know who signed what.</span>
        </p>
      ) : null}

      {waiting.length ? (
        <Section title={`Waiting for your sign-off (${waiting.length})`} records={waiting} />
      ) : records.length ? (
        <p className="mt-8 inline-flex items-center gap-2 text-sm text-good">
          <Check className="h-4 w-4" /> Nothing is waiting for your sign-off.
        </p>
      ) : null}
      <Section title="Drafts" records={drafts} />
      <Section
        title="Locked"
        records={locked}
        empty={canCreate ? "Nothing locked yet. Start with a new record, or propose your policy first." : "Nothing locked yet."}
      />
      {archived.length ? (
        <details className="group mt-10">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            Archived ({archived.length})
            <ChevronDown className="h-4 w-4 text-ink/70 transition group-open:rotate-180" />
          </summary>
          <p className="mt-1 text-sm text-ink/70">Archived drafts and retired records. Nothing here is used by the agent, Jira checks or the API.</p>
          <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
            {archived.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
