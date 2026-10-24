import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import NewRecordForm from "@/components/app/NewRecordForm";
import { getContext } from "@/lib/app/context";
import { eligibleSigners, MAX_CLAIMS } from "@/lib/app/records";
import { findTemplate, templatesFor } from "@/lib/app/templates";

export default async function NewRecordPage({ searchParams }: { searchParams: Promise<{ kind?: string; template?: string }> }) {
  const { kind: k, template: t } = await searchParams;
  const kind = k === "policy" ? "policy" : "requirements";
  const ctx = await getContext("/app/records/new");
  if (!ctx.current) redirect("/app");
  const role = ctx.current.role;
  if (role === "viewer" || (kind === "policy" && role !== "owner")) redirect("/app");
  const candidates = await eligibleSigners(ctx.current.orgId);
  const template = findTemplate(t, kind);
  const templates = templatesFor(kind);
  const base = kind === "policy" ? "/app/records/new?kind=policy" : "/app/records/new";
  const withTemplate = (id: string) => `${base}${base.includes("?") ? "&" : "?"}template=${id}`;

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-accent">{ctx.current.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{kind === "policy" ? "Propose the policy" : "New record"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        {kind === "policy"
          ? "The policy is the set of rules every other record is checked against. Once it's locked, changes go through review and sign-off like anything else."
          : "Write what needs agreeing, choose who signs it off, then send it for AI review."}{" "}
        <Link href="/app" className="text-steel underline hover:text-ink">Cancel</Link>
      </p>

      {template ? (
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-sm">
          <span>
            Started from the <strong>{template.title}</strong> template. Edit every line so it says what your team actually needs.
          </span>
          <Link href={base} className="inline-flex items-center gap-1 font-semibold text-steel hover:text-ink">
            <X className="h-3.5 w-3.5" /> Start from scratch
          </Link>
        </p>
      ) : (
        <section className="mt-8" aria-labelledby="templates">
          <h2 id="templates" className="text-sm font-semibold">Start from a template</h2>
          <p className="mt-1 text-sm text-ink/70">
            It fills in the form below with example wording. You edit it before anything is reviewed or signed.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <Link
                  href={withTemplate(tpl.id)}
                  className="group flex h-full flex-col rounded-xl border border-ink/15 bg-surface p-4 hover:border-ink/35"
                >
                  <span className="flex items-start justify-between gap-2 font-semibold">
                    {tpl.title}
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink/70 transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 text-sm text-ink/70">{tpl.summary}</span>
                  <span className="mt-2 text-xs text-muted">{tpl.statements.length} lines</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm font-semibold">Or write your own</p>
        </section>
      )}

      <div className={template ? "mt-8" : "mt-3"}>
        <NewRecordForm
          key={template?.id ?? "blank"}
          kind={kind}
          candidates={candidates}
          meId={ctx.user.id}
          maxClaims={MAX_CLAIMS}
          initialTitle={template?.title}
          initialStatements={template?.statements}
        />
      </div>
    </div>
  );
}
