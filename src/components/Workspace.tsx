"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Fingerprint,
  Loader2,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { KnowledgeClaim } from "@/lib/protocol";
import { api } from "@/lib/demo/client";
import { RISKY_REQUIREMENT } from "@/lib/demo/scenario";
import type { ModelReview, RecordView, ReviewIssue, Stakeholder } from "@/lib/demo/types";
import { Card, Pill, shortHash } from "./Shell";

const PROVIDER_LABEL = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" } as const;

const STEPS = ["Propose", "Review", "Lock", "Build from it"];

export default function Workspace({
  initial,
  policy,
  policyTitle,
}: {
  initial: RecordView;
  policy: KnowledgeClaim[];
  policyTitle: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [title, setTitle] = useState(initial.record.payload.title);
  const [items, setItems] = useState(initial.record.payload.claims.map((c) => c.statement));
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");

  const { record, evaluation, stakeholders, providers } = view;

  useEffect(() => {
    if (record.status === "locked" && record.lockId) router.replace(`/l/${record.lockId}`);
  }, [record.status, record.lockId, router]);

  const savedItems = record.payload.claims.map((c) => c.statement);
  const dirty = title !== record.payload.title || items.join("\u0000") !== savedItems.join("\u0000");
  const reviewed = record.modelReviews.length > 0;
  const step = evaluation.passed ? 2 : reviewed || reviewing ? 1 : 0;

  const issuesByReq = useMemo(() => {
    const map = new Map<string, { issue: ReviewIssue; provider: string }[]>();
    for (const r of record.modelReviews) {
      for (const issue of r.issues) {
        const list = map.get(issue.requirementId) ?? [];
        list.push({ issue, provider: PROVIDER_LABEL[r.provider] });
        map.set(issue.requirementId, list);
      }
    }
    return map;
  }, [record.modelReviews]);

  async function run<T>(fn: () => Promise<T>, setBusy?: (b: boolean) => void): Promise<T | undefined> {
    setError("");
    setBusy?.(true);
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
      return undefined;
    } finally {
      setBusy?.(false);
    }
  }

  async function save(): Promise<RecordView | undefined> {
    const next = await run(() => api.updateRecord(record.id, title, items), setSaving);
    if (next) {
      setView(next);
      setTitle(next.record.payload.title);
      setItems(next.record.payload.claims.map((c) => c.statement));
    }
    return next;
  }

  async function sendForReview() {
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    const next = await run(() => api.review(record.id), setReviewing);
    if (next) setView(next);
    document.getElementById("review")?.scrollIntoView();
  }

  async function lock() {
    const res = await run(() => api.lock(record.id), setLocking);
    if (res) router.push(`/l/${res.lockId}?new=1`);
  }

  const hasRisky = items.some((s) => s === RISKY_REQUIREMENT);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">Draft · v{record.version}</Pill>
            {record.parentLockId ? (
              <Link href={`/l/${record.parentLockId}`} className="text-xs font-semibold text-accent hover:underline">
                Change to locked v{record.version - 1}
              </Link>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{record.payload.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted" title="A fingerprint of the exact wording. Any edit changes it, and reviews or sign-offs given for earlier wording stop counting.">
          <Fingerprint className="h-4 w-4" />
          <span className="font-mono">{shortHash(record.payloadHash)}</span>
        </div>
      </div>

      <Stepper current={step} />

      {error ? (
        <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-10">
          {/* 1. Propose */}
          <section id="propose">
            <SectionTitle n={1} title="Propose" text="Edit the draft. Any change resets reviews and sign-offs, because they were given for different wording." />
            <Card>
              <label className="block text-xs font-semibold text-ink/70" htmlFor="record-title">
                Title
              </label>
              <input
                id="record-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-bg/70 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <ol className="mt-5 space-y-3">
                {items.map((statement, i) => {
                  const id = `R${i + 1}`;
                  const found = !dirty ? issuesByReq.get(id) ?? [] : [];
                  const blocker = found.some((f) => f.issue.severity === "blocker");
                  return (
                    <li key={i} className={`rounded-xl border p-3 ${blocker ? "border-bad/50 bg-bad/5" : found.length ? "border-warn/50 bg-warn/5" : "border-ink/10"}`}>
                      <div className="flex items-start gap-3">
                        <span className="mt-2 w-7 shrink-0 font-mono text-xs font-semibold text-accent">{id}</span>
                        <textarea
                          aria-label={`Requirement ${id}`}
                          value={statement}
                          onChange={(e) => setItems(items.map((s, j) => (j === i ? e.target.value : s)))}
                          rows={Math.max(2, Math.ceil(statement.length / 40))}
                          maxLength={600}
                          className="field-sizing-content min-h-[3.25rem] w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none focus:border-ink/15 focus:bg-bg/70"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${id}`}
                          onClick={() => setItems(items.filter((_, j) => j !== i))}
                          className="mt-1.5 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-bad"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {found.length ? (
                        <ul className="ml-10 mt-2 space-y-1.5">
                          {found.map((f, k) => (
                            <li key={k} className={`text-xs leading-relaxed ${f.issue.severity === "blocker" ? "text-bad" : "text-warn"}`}>
                              <span className="font-semibold">
                                {f.provider}: {f.issue.type}
                                {f.issue.policyRef ? ` with ${f.issue.policyRef}` : ""}.
                              </span>{" "}
                              {f.issue.detail}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setItems([...items, ""])}
                  disabled={items.length >= 12}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold hover:border-ink/30 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Add requirement
                </button>
                {!hasRisky ? (
                  <button
                    type="button"
                    onClick={() => setItems([...items, RISKY_REQUIREMENT])}
                    disabled={items.length >= 12}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-warn/60 px-3 py-1.5 text-sm font-semibold text-warn hover:bg-warn/5 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4" /> Add a requirement that breaks policy
                  </button>
                ) : null}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
                <button
                  type="button"
                  onClick={sendForReview}
                  disabled={reviewing || saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {reviewing ? "Models reviewing…" : reviewed && !dirty ? "Review again" : "Send for review"}
                </button>
                {dirty ? (
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold hover:border-ink/30 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                ) : null}
                {dirty ? <span className="text-xs text-warn">Unsaved changes</span> : null}
              </div>
            </Card>
          </section>

          {/* 2. Review */}
          <section id="review">
            <SectionTitle n={2} title="Review" text="Independent models check the draft against the locked policy, and each stakeholder signs off." />
            <h3 className="mb-3 text-sm font-semibold text-ink/70">AI reviewers</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {providers.map((p) => (
                <ModelCard
                  key={p.id}
                  label={PROVIDER_LABEL[p.id]}
                  model={p.model}
                  configured={p.configured}
                  review={dirty ? undefined : record.modelReviews.find((r) => r.provider === p.id)}
                  running={reviewing}
                />
              ))}
            </div>
            <h3 className="mb-3 mt-8 text-sm font-semibold text-ink/70">Stakeholders</h3>
            <p className="mb-3 text-xs text-muted">In a pilot each person signs in to sign off. In this demo you can act for all three.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {stakeholders.map((s) => (
                <StakeholderCard
                  key={s.role}
                  stakeholder={s}
                  attestation={record.attestations.find((a) => a.attestorType === "human" && a.role === s.role)}
                  disabled={dirty}
                  onSign={async (decision, comment) => {
                    const next = await run(() => api.signOff(record.id, s.role, decision, comment));
                    if (next) setView(next);
                    return Boolean(next);
                  }}
                />
              ))}
            </div>
          </section>

          {/* 3. Lock */}
          <section id="lock">
            <SectionTitle n={3} title="Lock" text={`Rules for this record: two or more models from different providers approve with no objections, and Product, Compliance and Engineering all sign off.`} />
            <Card>
              <Checklist view={view} />
              <div className="mt-6 border-t border-ink/10 pt-5">
                <button
                  type="button"
                  onClick={lock}
                  disabled={!evaluation.passed || dirty || locking}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {locking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Lock this version
                </button>
                {!evaluation.passed ? (
                  <p className="mt-2 text-xs text-muted">Locking unlocks once every rule above is met.</p>
                ) : null}
              </div>
            </Card>
          </section>
        </div>

        {/* Sidebar: the locked policy */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-good" /> Already locked
            </div>
            <p className="mt-1 text-xs text-muted">{policyTitle}</p>
            <ol className="mt-4 space-y-2.5">
              {policy.map((c) => (
                <li key={c.id} className="text-xs leading-relaxed text-ink/75">
                  <span className="mr-1.5 font-mono font-semibold text-ink">{c.id}</span>
                  {c.statement}
                </li>
              ))}
            </ol>
            <Link href={`/l/${view.policyLockId}`} className="mt-4 inline-block text-xs font-semibold text-accent hover:underline">
              View the locked policy
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              active ? "border-accent bg-accent/10 font-semibold" : done ? "border-good/40 text-ink/80" : "border-ink/10 text-muted"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${
                done ? "bg-good text-white" : active ? "bg-accent text-white" : "border border-ink/20"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function SectionTitle({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold tracking-tight">
        <span className="mr-2 font-mono text-sm text-accent">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      <p className="mt-1 text-sm text-ink/70">{text}</p>
    </div>
  );
}

function ModelCard({
  label,
  model,
  configured,
  review,
  running,
}: {
  label: string;
  model: string;
  configured: boolean;
  review?: ModelReview;
  running: boolean;
}) {
  let status: React.ReactNode = <Pill>Not run yet</Pill>;
  if (!configured) status = <Pill>Not configured</Pill>;
  else if (running) status = <Pill tone="accent"><Loader2 className="h-3 w-3 animate-spin" /> Reviewing</Pill>;
  else if (review?.status === "error") status = <Pill tone="warn">Error</Pill>;
  else if (review?.decision === "APPROVE") status = <Pill tone="good"><Check className="h-3 w-3" /> Approves</Pill>;
  else if (review?.decision === "REJECT") status = <Pill tone="bad"><X className="h-3 w-3" /> Objects</Pill>;

  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{label}</p>
          <p className="truncate font-mono text-[11px] text-muted">{model}</p>
        </div>
        {status}
      </div>
      {!running && review?.status === "ok" ? (
        <div className="mt-3 space-y-2">
          {review.stub ? <p className="font-mono text-[10px] uppercase tracking-wider text-warn">Local test stub, not a real model</p> : null}
          <p className="text-sm leading-relaxed text-ink/80">{review.summary}</p>
          {review.issues.length ? (
            <p className="text-xs text-muted">
              {review.issues.length} issue{review.issues.length === 1 ? "" : "s"} raised, shown against the requirements above.
            </p>
          ) : null}
          <p className="text-[11px] text-muted">{(review.durationMs / 1000).toFixed(1)}s</p>
        </div>
      ) : null}
      {!running && review?.status === "error" ? <p className="mt-3 text-xs text-warn">{review.error}</p> : null}
      {!configured ? <p className="mt-3 text-xs text-muted">No API key for this provider on the server.</p> : null}
    </Card>
  );
}

function StakeholderCard({
  stakeholder,
  attestation,
  disabled,
  onSign,
}: {
  stakeholder: Stakeholder;
  attestation?: { decision: string; reasoning?: string };
  disabled: boolean;
  onSign: (decision: "APPROVE" | "REJECT", comment?: string) => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function sign(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    const ok = await onSign(decision, decision === "REJECT" ? comment : undefined);
    setBusy(false);
    if (ok) {
      setAsking(false);
      setComment("");
    }
  }

  const status =
    attestation?.decision === "APPROVE" ? (
      <Pill tone="good"><Check className="h-3 w-3" /> Signed off</Pill>
    ) : attestation?.decision === "REJECT" ? (
      <Pill tone="bad">Changes requested</Pill>
    ) : (
      <Pill><CircleDashed className="h-3 w-3" /> Pending</Pill>
    );

  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{stakeholder.name}</p>
          <p className="text-xs text-muted">{stakeholder.title}</p>
        </div>
        {status}
      </div>
      {attestation?.decision === "REJECT" && attestation.reasoning ? (
        <p className="mt-3 text-xs italic text-ink/75">&ldquo;{attestation.reasoning}&rdquo;</p>
      ) : null}
      {asking ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="What needs to change?"
            aria-label={`What ${stakeholder.name} wants changed`}
            className="w-full rounded-lg border border-ink/15 bg-bg/70 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => sign("REJECT")}
              disabled={busy || !comment.trim()}
              className="rounded-lg bg-bad px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Request changes
            </button>
            <button type="button" onClick={() => setAsking(false)} className="px-2 text-xs text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => sign("APPROVE")}
            disabled={busy || disabled || attestation?.decision === "APPROVE"}
            className="inline-flex items-center gap-1 rounded-lg border border-good/50 px-3 py-1.5 text-xs font-semibold text-good hover:bg-good/10 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Sign off
          </button>
          <button
            type="button"
            onClick={() => setAsking(true)}
            disabled={busy || disabled}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-ink/30 disabled:opacity-40"
          >
            Request changes
          </button>
        </div>
      )}
    </Card>
  );
}

function Checklist({ view }: { view: RecordView }) {
  const { record, evaluation, stakeholders } = view;
  const m = evaluation.metrics;
  const reviewedOk = record.modelReviews.filter((r) => r.status === "ok").length;
  const signedRoles = new Set(
    record.attestations.filter((a) => a.attestorType === "human" && a.decision === "APPROVE").map((a) => a.role)
  );
  const vetoed = record.attestations.some((a) => a.attestorType === "human" && a.decision === "REJECT");

  const items = [
    {
      ok: m.distinctModelCount >= 2 && m.distinctProviderCount >= 2,
      label: `Two or more models from different providers approve (${m.modelApprovals} so far)`,
    },
    { ok: reviewedOk > 0 && m.modelRejections === 0, label: reviewedOk ? `No model objects (${m.modelRejections} objecting)` : "No model objects (not reviewed yet)" },
    ...stakeholders.map((s) => ({ ok: signedRoles.has(s.role), label: `${s.name} signs off` })),
    { ok: !vetoed, label: vetoed ? "A stakeholder has requested changes" : "No stakeholder has requested changes" },
  ];

  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-start gap-2.5 text-sm">
          {it.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />
          ) : (
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          )}
          <span className={it.ok ? "" : "text-ink/70"}>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
