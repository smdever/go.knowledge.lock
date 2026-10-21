import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Check, Lock, ShieldCheck, User, X } from "lucide-react";
import Shell, { Card, Pill, shortHash } from "@/components/Shell";
import { Build, Verify } from "@/components/LockTools";
import StartButton from "@/components/StartButton";
import ScrollToTop from "@/components/ScrollToTop";
import Tour from "@/components/Tour";
import type { Resolution } from "@/lib/demo/types";
import { getLockView } from "@/lib/demo/service";
import { SAMPLE_QUESTIONS, SAMPLE_TICKET } from "@/lib/demo/scenario";

export const dynamic = "force-dynamic";

const PROVIDER_NAMES = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" } as const;

const fmt = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(ms);

export default async function LockPage({
  params,
  searchParams,
}: {
  params: Promise<{ lockId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { lockId } = await params;
  const { new: isNew } = await searchParams;
  const view = await getLockView(lockId);
  if (!view) notFound();
  const { block, verification, supersededBy, isPolicy } = view;
  const version = Number(block.payload.metadata?.version ?? 1);
  const resolutions = (block.payload.metadata?.resolutions as Resolution[] | undefined) ?? [];
  const people = block.consensus.attestations.filter((a) => a.attestorType === "human");
  const models = block.consensus.attestations.filter((a) => a.attestorType === "model");

  return (
    <Shell>
      {isNew ? <ScrollToTop /> : null}
      {isNew ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 p-3 text-sm text-good">
          <Check className="h-4 w-4" /> Locked. This version is now the signed-off source for teams and agents.
        </div>
      ) : null}
      {supersededBy ? (
        <div className="mb-6 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          A newer version has replaced this one.{" "}
          <Link href={`/l/${supersededBy}`} className="font-semibold underline">
            Open the current version
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="good"><Lock className="h-3 w-3" /> Locked</Pill>
            {isPolicy ? <Pill>Policy · seeded for the demo</Pill> : <Pill>Requirements · v{version}</Pill>}
            {block.parentLockId ? (
              <Link href={`/l/${block.parentLockId}`} className="text-xs font-semibold text-accent hover:underline">
                Replaces v{version - 1}
              </Link>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{block.payload.title}</h1>
          <p className="mt-1 text-sm text-muted">Locked {fmt(block.lockedAt)}</p>
        </div>
        <p className="font-mono text-xs text-muted" title={block.lockId}>
          {shortHash(block.lockId)}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Card>
            <h2 className="font-bold">{isPolicy ? "Policy statements" : "Requirements"}</h2>
            <ol className="mt-4 space-y-3">
              {block.payload.claims.map((c) => (
                <li key={c.id} className="flex gap-3 text-sm leading-relaxed">
                  <span className="w-7 shrink-0 font-mono text-xs font-semibold text-accent">{c.id}</span>
                  <span>{c.statement}</span>
                </li>
              ))}
            </ol>
          </Card>

          {resolutions.length ? (
            <Card>
              <h2 className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-4 w-4 text-good" /> Objections resolved before locking
              </h2>
              <p className="mt-1 text-sm text-ink/70">Part of the signed record, so the history can&apos;t be rewritten.</p>
              <ul className="mt-4 space-y-4">
                {resolutions.map((r, i) => (
                  <li key={i} className="rounded-xl border border-ink/10 p-4 text-sm">
                    <p>
                      <span className="font-mono text-xs font-semibold text-accent">{r.requirementId}</span>{" "}
                      <span className="text-ink/60 line-through decoration-bad/50">{r.originalStatement}</span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {r.issues.map((issue, k) => (
                        <li key={k} className="text-xs text-bad">
                          <span className="font-semibold">
                            {PROVIDER_NAMES[issue.provider]} objected{issue.policyRef ? ` (conflict with ${issue.policyRef})` : ""}:
                          </span>{" "}
                          {issue.detail}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-good">
                      {r.outcome === "removed"
                        ? "Resolved by removing the requirement, then re-reviewed and approved."
                        : `Resolved by rewording${r.suggestedBy ? ` suggested by ${PROVIDER_NAMES[r.suggestedBy]}` : ""}, then re-reviewed and approved.`}
                    </p>
                    {r.newStatement ? <p className="mt-1.5 text-sm">{r.newStatement}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-bold">Who agreed</h2>
            <p className="mt-1 text-sm text-ink/70">
              {block.consensus.policy.description ?? block.consensus.policy.name}
            </p>
            <ul className="mt-4 divide-y divide-ink/10">
              {people.map((a) => (
                <li key={a.attestationId} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <span className="flex items-start gap-2">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <span>{a.attestorId}</span>
                  </span>
                  <Pill tone={a.decision === "APPROVE" ? "good" : "bad"}>
                    {a.decision === "APPROVE" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {a.decision === "APPROVE" ? "Signed off" : "Objected"}
                  </Pill>
                </li>
              ))}
              {models.map((a) => (
                <li key={a.attestationId} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-start gap-2">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      <span>
                        <span className="font-mono text-xs">{a.attestorId}</span>
                        {a.isLive === false ? <span className="ml-2 font-mono text-[10px] uppercase text-warn">test stub</span> : null}
                      </span>
                    </span>
                    <Pill tone={a.decision === "APPROVE" ? "good" : "bad"}>
                      {a.decision === "APPROVE" ? "Approved" : "Objected"}
                    </Pill>
                  </div>
                  {a.reasoning ? <p className="ml-6 mt-1 text-xs text-ink/70">{a.reasoning}</p> : null}
                </li>
              ))}
            </ul>
          </Card>

          {!isPolicy ? (
            <Build lockId={block.lockId} questions={SAMPLE_QUESTIONS} sampleTicket={SAMPLE_TICKET} />
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Verify block={block} serverResult={verification} authorityEphemeral={view.authorityEphemeral} />
          {!isPolicy && !supersededBy ? (
            <Card tour="propose">
              <h2 className="font-bold">Need to change it?</h2>
              <p className="mt-1 text-sm text-ink/70">
                Locked records are never edited. A change becomes a new version that goes back through review.
              </p>
              <div className="mt-4">
                <StartButton parentLockId={block.lockId} label="Propose a change" />
              </div>
            </Card>
          ) : null}
          {!isPolicy ? (
            <Link href={`/l/${view.policyLockId}`} className="block text-sm font-semibold text-accent hover:underline">
              View the locked policy it was checked against
            </Link>
          ) : (
            <StartButton label="Start the demo" />
          )}
        </aside>
      </div>
      {!isPolicy ? <Tour page="lock" isNew={Boolean(isNew)} /> : null}
    </Shell>
  );
}
