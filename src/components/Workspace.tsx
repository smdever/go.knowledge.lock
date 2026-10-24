"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Loader2, Lock, Plus, Sparkles, Trash2, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Avatar from "./Avatar";
import type { KnowledgeClaim } from "@/lib/protocol";
import type { FixSuggestion, ProviderId, RecordView, ReviewIssue, SignerView } from "@/lib/demo/types";
import { useKL } from "./KLContext";

const PROVIDER_LABEL: Record<ProviderId, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" };

type Screen = "propose" | "review" | "signoff" | "lock";
const SCREENS: { id: Screen; label: string }[] = [
  { id: "propose", label: "Propose" },
  { id: "review", label: "AI review" },
  { id: "signoff", label: "Sign off" },
  { id: "lock", label: "Lock" },
];

interface Objection {
  claim: KnowledgeClaim;
  index: number;
  raisedBy: ProviderId[];
  policyRefs: string[];
  reasons: { provider: ProviderId; issue: ReviewIssue }[];
}

const EASE = [0.22, 1, 0.36, 1] as const;

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-steel">{children}</p>;
}

/** Word-level diff: which words of `after` are new. Returns null when the wording was largely rewritten. */
export function changedWords(before: string, after: string): boolean[] | null {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  if (!a.length || !b.length || a.length * b.length > 40000) return null;
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}£$%]/gu, "");
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const isNew = new Array<boolean>(b.length).fill(true);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (norm(a[i]) === norm(b[j])) {
      isNew[j] = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // Highlighting is only useful when most of the wording stayed the same.
  return dp[0][0] / b.length >= 0.4 ? isNew : null;
}

/** The suggested wording, with new words highlighted when it's an edit rather than a rewrite. */
function Changed({ before, after }: { before: string; after: string }) {
  const flags = changedWords(before, after);
  if (!flags) return <>{after}</>;
  const words = after.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, k) => (
        <span key={k}>
          {flags[k] ? <mark className="rounded-sm bg-good/15 px-0.5 text-ink underline decoration-good/60 underline-offset-2">{w}</mark> : w}
          {k < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export default function Workspace({ initial, policy }: { initial: RecordView; policy: KnowledgeClaim[] }) {
  const router = useRouter();
  const kl = useKL();
  const api = kl.api;
  const product = kl.mode === "app";
  const [view, setView] = useState(initial);
  const [items, setItems] = useState(initial.record.payload.claims.map((c) => c.statement));
  const [busy, setBusy] = useState<"" | "saving" | "reviewing" | "locking">("");
  // Sign-offs in flight or waiting, by role. They're sent one at a time so none overwrites another.
  const [pending, setPending] = useState<Record<string, "APPROVE" | "REJECT">>({});
  const signQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null);
  const [error, setError] = useState("");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const { record, evaluation, providers } = view;
  // The demo's three stakeholders can all be signed for by whoever is watching; product signers only by themselves.
  const signers: SignerView[] =
    view.signers ??
    view.stakeholders.map((s) => ({ key: s.role, name: s.name, title: s.title, avatarRole: s.role, canSign: true }));
  const quorum = view.quorum ?? signers.length;
  const canEdit = view.canEdit ?? true;
  const prefix = view.claimPrefix ?? "R";
  const maxClaims = view.maxClaims ?? 12;
  const isPolicyRecord = view.kind === "policy";
  const savedItems = record.payload.claims.map((c) => c.statement);
  const dirty = items.join("\u0000") !== savedItems.join("\u0000");

  // ---- What the reviews say about the current wording
  const reviews = record.modelReviews.filter((r) => r.subjectHash === record.payloadHash);
  const okReviews = useMemo(() => reviews.filter((r) => r.status === "ok"), [reviews]);
  const failedReviews = reviews.filter((r) => r.status === "error");
  const configured = providers.filter((p) => p.configured);

  const objections = useMemo<Objection[]>(() => {
    const out: Objection[] = [];
    record.payload.claims.forEach((claim, index) => {
      const reasons = okReviews.flatMap((r) =>
        r.issues
          .filter((i) => i.requirementId === claim.id && i.severity === "blocker")
          .map((issue) => ({ provider: r.provider, issue }))
      );
      if (!reasons.length) return;
      out.push({
        claim,
        index,
        raisedBy: [...new Set(reasons.map((r) => r.provider))],
        policyRefs: [...new Set(reasons.map((r) => r.issue.policyRef).filter((p): p is string => Boolean(p)))],
        reasons,
      });
    });
    return out;
  }, [record.payload.claims, okReviews]);

  const notes = okReviews.flatMap((r) =>
    r.issues.filter((i) => i.severity !== "blocker").map((issue) => ({ provider: r.provider, issue }))
  );
  const m = evaluation.metrics;
  const modelsPass =
    okReviews.length > 0 && m.distinctModelCount >= 2 && m.distinctProviderCount >= 2 && m.modelRejections === 0;
  const humans = record.attestations.filter((a) => a.attestorType === "human" && a.subjectHash === record.payloadHash);
  const signedRoles = new Set(humans.filter((a) => a.decision === "APPROVE").map((a) => a.role));
  const objectors = humans.filter((a) => a.decision === "REJECT").length;
  const approvals = signers.filter((s) => signedRoles.has(s.key)).length;
  const allSigned = approvals >= quorum && objectors === 0;
  const resolvedCount = record.resolutions?.length ?? 0;

  const [screen, setScreen] = useState<Screen>(() =>
    initial.evaluation.passed
      ? "lock"
      : initial.record.modelReviews.some((r) => r.subjectHash === initial.record.payloadHash)
        ? "review"
        : "propose"
  );

  const reachable: Record<Screen, boolean> = {
    propose: true,
    review: reviews.length > 0 || busy === "reviewing" || busy === "saving",
    signoff: modelsPass,
    lock: evaluation.passed,
  };

  useEffect(() => {
    if (record.status === "locked" && record.lockId) router.replace(kl.lockPath(record.lockId));
  }, [record.status, record.lockId, router, kl]);

  // In the product, colleagues sign from their own accounts, so keep the sign-off and lock screens current.
  const live = product && (screen === "signoff" || screen === "lock") && !busy && Object.keys(pending).length === 0;
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await api.getRecord(record.id);
        setView(next);
      } catch {
        // try again on the next tick
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [live, api, record.id]);

  useEffect(() => {
    if (screen !== "propose" || focusIndex === null) return;
    // The draft screen mounts after the previous screen has animated out, so wait for the field.
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById(`req-${focusIndex}`) as HTMLTextAreaElement | null;
      if (el || ++tries > 30) {
        window.clearInterval(timer);
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [screen, focusIndex]);

  function go(next: Screen) {
    setScreen(next);
    setError("");
  }

  async function attempt<T>(fn: () => Promise<T>, state: typeof busy): Promise<T | undefined> {
    setError("");
    setBusy(state);
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
      return undefined;
    } finally {
      setBusy("");
    }
  }

  function adopt(next: RecordView) {
    setView(next);
    setItems(next.record.payload.claims.map((c) => c.statement));
  }

  async function sendForReview(nextItems?: string[], fix?: { requirementId: string; provider: ProviderId }) {
    setSuggestion(null);
    setFocusIndex(null);
    go("review");
    if (nextItems || dirty) {
      const saved = await attempt(
        () => api.updateRecord(record.id, record.payload.title, nextItems ?? items, fix),
        "saving"
      );
      if (!saved) return;
      adopt(saved);
    }
    const next = await attempt(() => api.review(record.id), "reviewing");
    if (next) adopt(next);
  }

  async function askForFix(o: Objection) {
    setSuggestion(null);
    setError("");
    setSuggesting(o.claim.id);
    try {
      setSuggestion(await api.suggestFix(record.id, o.claim.id, o.raisedBy[0]));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSuggesting(null);
    }
  }

  function sign(role: string, decision: "APPROVE" | "REJECT", comment?: string): Promise<boolean> {
    setError("");
    setPending((p) => ({ ...p, [role]: decision }));
    const run = signQueue.current.then(async () => {
      try {
        adopt(await api.signOff(record.id, role, decision, comment));
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      } finally {
        setPending((p) => {
          const rest = { ...p };
          delete rest[role];
          return rest;
        });
      }
    });
    signQueue.current = run;
    return run;
  }

  function signAll() {
    for (const s of signers) {
      if (s.canSign && !signedRoles.has(s.key) && !pending[s.key]) void sign(s.key, "APPROVE");
    }
  }

  async function lock() {
    const res = await attempt(() => api.lock(record.id), "locking");
    if (res) router.push(`${kl.lockPath(res.lockId)}?new=1`);
  }

  const reviewing = busy === "reviewing" || busy === "saving";

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto max-w-[680px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">{record.payload.title}</p>
        <p className="text-sm text-muted">
          {record.version > 1 ? (
            <>
              Draft v{record.version}, changing{" "}
              <Link href={kl.lockPath(record.parentLockId ?? "")} className="underline hover:text-ink">
                locked v{record.version - 1}
              </Link>
            </>
          ) : (
            "Draft v1"
          )}
        </p>
      </div>

      <StepBar screen={screen} reachable={reachable} onGo={go} />

      {error ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-lg border border-bad/40 bg-surface px-3 py-2.5 text-sm text-bad"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
      {/* ---------------- Propose ---------------- */}
      {screen === "propose" ? (
        <Screen key="propose">
          <Heading
            title={
              record.version > 1
                ? "Make your change"
                : product
                  ? isPolicyRecord
                    ? "Your policy, ready for review"
                    : "Your draft, ready for review"
                  : "One of these requirements breaks the bank's policy"
            }
            text={
              record.version > 1
                ? "Edit the wording, then send it for review. Everything is checked again from scratch."
                : product
                  ? isPolicyRecord
                    ? "Edit the rules if you need to. The AI reviewers check them for contradictions and unclear wording."
                    : policy.length
                      ? "Edit the wording if you need to, then send it for review. The AI reviewers check every line against your locked policy."
                      : "Edit the wording if you need to, then send it for review. There's no locked policy yet, so the reviewers check for contradictions and unclear wording."
                  : "Halden Bank's teams drafted these for an AI complaints assistant. Send them for review and see whether the AI reviewers catch it."
            }
          />
          <ol className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {items.map((statement, i) => (
              <li key={i} className="group flex items-start gap-3 py-3">
                <span className="w-7 shrink-0 pt-2 text-sm font-semibold text-steel">
                  {prefix}
                  {i + 1}
                </span>
                <textarea
                  id={`req-${i}`}
                  aria-label={`${isPolicyRecord ? "Rule" : "Requirement"} ${prefix}${i + 1}`}
                  value={statement}
                  readOnly={!canEdit}
                  onChange={(e) => setItems(items.map((s, j) => (j === i ? e.target.value : s)))}
                  rows={Math.max(2, Math.ceil(statement.length / 70))}
                  maxLength={600}
                  className="field-sizing-content w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[15px] leading-relaxed outline-none hover:border-ink/10 focus:border-accent/60 focus:bg-surface"
                />
                {canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove ${prefix}${i + 1}`}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                  className="mt-1.5 rounded-md p-1.5 text-muted opacity-60 hover:bg-ink/5 hover:text-bad group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                ) : null}
              </li>
            ))}
          </ol>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setItems([...items, ""])}
              disabled={items.length >= maxClaims}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-ink disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {isPolicyRecord ? "Add a rule" : "Add a requirement"}
            </button>
          ) : (
            <p className="mt-3 text-sm text-muted">You can read this draft. Owners and signers can change it.</p>
          )}

          {policy.length ? <PolicyDrawer policy={policy} /> : null}

          <Footer>
            <span />
            {!dirty && reviews.length ? (
              <PrimaryButton onClick={() => go("review")}>See the review</PrimaryButton>
            ) : canEdit ? (
              <PrimaryButton onClick={() => sendForReview()}>Send for review</PrimaryButton>
            ) : (
              <span />
            )}
          </Footer>
        </Screen>
      ) : null}

      {/* ---------------- AI review ---------------- */}
      {screen === "review" ? (
        <Screen key="review">
          {reviewing ? (
            <Heading
              title={resolvedCount ? "The reviewers are checking the new wording" : "Three AI reviewers are reading the draft"}
              text={
                product && !policy.length
                  ? "Each one reads every line independently of the others, looking for contradictions and unclear wording. This takes a few seconds."
                  : "Each one checks every requirement against the locked policy, independently of the others. This takes a few seconds."
              }
            />
          ) : objections.length ? (
            <Heading
              title={
                objections.length === 1
                  ? `Blocked: ${objections[0].claim.id} ${product ? "has a problem the reviewers won't pass" : "conflicts with the bank's policy"}`
                  : `Blocked: ${objections.length} ${product ? "lines have problems the reviewers won't pass" : "requirements conflict with the bank's policy"}`
              }
              text="Nothing can be locked while an AI reviewer objects. Fix it here and it goes straight back for review."
            />
          ) : modelsPass ? (
            <Heading
              title={m.modelApprovals === configured.length ? "All the AI reviewers approve" : `${m.modelApprovals} AI reviewers approve`}
              text={
                resolvedCount
                  ? "The fix worked. How the objection was resolved will be recorded in the lock. Next, the people sign off."
                  : product && !policy.length
                    ? "No contradictions or blocking problems found. Next, the people sign off."
                    : "No conflicts with the locked policy. Next, the people sign off."
              }
            />
          ) : (
            <Heading
              title="The review didn't finish"
              text="At least two reviewers from different providers need to respond. Run the review again."
            />
          )}

          <AnimatePresence initial={false}>
          {!reviewing
            ? objections.map((o) => (
                <ObjectionCard
                  key={o.claim.id}
                  objection={o}
                  policy={policy}
                  suggestion={suggestion?.requirementId === o.claim.id ? suggestion : null}
                  suggesting={suggesting === o.claim.id}
                  disabled={Boolean(busy) || Boolean(suggesting) || !canEdit}
                  onSuggest={() => askForFix(o)}
                  onAccept={() => {
                    if (!suggestion) return;
                    const next = items.map((s, j) => (j === o.index ? suggestion.statement : s));
                    void sendForReview(next, { requirementId: suggestion.requirementId, provider: suggestion.provider });
                  }}
                  onDismiss={() => setSuggestion(null)}
                  onEdit={() => {
                    setSuggestion(null);
                    setFocusIndex(o.index);
                    go("propose");
                  }}
                  onRemove={() => void sendForReview(items.filter((_, j) => j !== o.index))}
                />
              ))
            : null}
          </AnimatePresence>

          <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {providers.map((p) => {
              const r = reviews.find((x) => x.provider === p.id);
              const state = !p.configured
                ? "off"
                : reviewing
                  ? "running"
                  : r?.status === "error"
                    ? "error"
                    : r?.decision === "APPROVE"
                      ? "approve"
                      : r?.decision === "REJECT"
                        ? "object"
                        : "idle";
              return (
                <ReviewerRow
                  key={p.id}
                  name={PROVIDER_LABEL[p.id]}
                  model={p.model}
                  state={state}
                  summary={r?.status === "error" ? r.error : objections.length ? undefined : r?.summary}
                  stub={r?.stub}
                />
              );
            })}
          </ul>


          {!reviewing && notes.length ? (
            <Disclosure label={`${notes.length} minor note${notes.length === 1 ? "" : "s"} (these don't block locking)`}>
              <ul className="space-y-2 text-sm text-ink/75">
                {notes.map((n, i) => (
                  <li key={i}>
                    <span className="font-semibold">
                      {n.issue.requirementId === "general" ? "General" : n.issue.requirementId}
                    </span>
                    {", "}
                    {PROVIDER_LABEL[n.provider]}: {n.issue.detail}
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : null}

          <Footer pinned={reviewing || !objections.length}>
            <SecondaryButton onClick={() => go("propose")}>Back to the draft</SecondaryButton>
            {reviewing ? (
              <PrimaryButton disabled>
                <Loader2 className="h-4 w-4 animate-spin" /> Reviewing
              </PrimaryButton>
            ) : modelsPass ? (
              <PrimaryButton onClick={() => go("signoff")}>Next: sign off</PrimaryButton>
            ) : canEdit && (!objections.length || failedReviews.length) ? (
              <PrimaryButton onClick={() => sendForReview()}>Review again</PrimaryButton>
            ) : (
              <span />
            )}
          </Footer>
        </Screen>
      ) : null}

      {/* ---------------- Sign off ---------------- */}
      {screen === "signoff" ? (
        <Screen key="signoff">
          <Heading
            title={
              allSigned
                ? product && approvals < signers.length
                  ? "Enough people have signed off"
                  : "Everyone has signed off"
                : objectors
                  ? "Someone has asked for changes"
                  : "Now the people sign off"
            }
            text={
              product
                ? `${quorum === signers.length ? "Everyone listed" : `${quorum} of the ${signers.length} people listed`} must approve this exact wording. An objection from anyone blocks the lock until they withdraw it or the wording changes. You can only sign for yourself.${
                    view.passkeys?.required
                      ? " Each sign-off must be signed with the person's own passkey."
                      : view.passkeys?.mine
                        ? " Your sign-off will be signed with your passkey."
                        : ""
                  }`
                : "Each person approves this exact wording. In a pilot they'd each sign in from their own account; here you can act for all three."
            }
          />
          <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {signers.map((s) => (
              <SignerRow
                key={s.key}
                signer={s}
                attestation={humans.find((a) => a.role === s.key)}
                pending={pending[s.key]}
                onSign={(decision, comment) => sign(s.key, decision, comment)}
              />
            ))}
          </ul>
          {product && view.passkeys && !view.passkeys.mine && signers.some((s) => s.canSign) ? (
            <p className={`mt-3 text-sm ${view.passkeys.required ? "text-bad" : "text-ink/70"}`}>
              {view.passkeys.required ? "You need a passkey to sign this. " : "Want your sign-off signed on your own device? "}
              <Link href="/app/profile#passkeys" className="font-semibold text-steel underline hover:text-ink">
                Set up a passkey
              </Link>
            </p>
          ) : null}
          {!product && !allSigned ? (
            <button
              type="button"
              onClick={signAll}
              disabled={signers.every((s) => signedRoles.has(s.key) || pending[s.key])}
              className="mt-3 text-sm font-semibold text-steel hover:text-ink disabled:opacity-50"
            >
              Sign off for all three
            </button>
          ) : null}
          <Footer>
            <SecondaryButton onClick={() => go("review")}>Back</SecondaryButton>
            <PrimaryButton onClick={() => go("lock")} disabled={!evaluation.passed}>
              Next: lock it
            </PrimaryButton>
          </Footer>
        </Screen>
      ) : null}

      {/* ---------------- Lock ---------------- */}
      {screen === "lock" ? (
        <Screen key="lock">
          <Heading
            title={evaluation.passed ? "Ready to lock" : "Not ready to lock yet"}
            text="Locking fingerprints this exact wording, signs it and stores it. From then on, nobody can quietly change it."
          />
          <ul className="mt-6 space-y-3 text-[15px]">
            <Done ok={modelsPass}>
              {m.modelApprovals} of {configured.length} AI reviewers approve, with no objections
            </Done>
            <Done ok={allSigned}>
              {product
                ? `${approvals} of ${quorum} required approvals${objectors ? `, and ${objectors} objection${objectors === 1 ? "" : "s"} to resolve` : ""}`
                : `${signedRoles.size} of ${signers.length} people have signed off`}
            </Done>
            {resolvedCount ? (
              <Done ok>
                {resolvedCount} objection{resolvedCount === 1 ? "" : "s"} resolved, and the fix is recorded in the lock
              </Done>
            ) : null}
          </ul>
          <Footer>
            <SecondaryButton onClick={() => go("signoff")}>Back</SecondaryButton>
            <PrimaryButton onClick={lock} disabled={!evaluation.passed || busy === "locking"}>
              {busy === "locking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Lock this version
            </PrimaryButton>
          </Footer>
        </Screen>
      ) : null}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

// ---------------- Pieces ----------------

function StepBar({
  screen,
  reachable,
  onGo,
}: {
  screen: Screen;
  reachable: Record<Screen, boolean>;
  onGo: (s: Screen) => void;
}) {
  const current = SCREENS.findIndex((s) => s.id === screen);
  return (
    <nav aria-label="Steps" className="mt-5">
      <ol className="grid grid-cols-4 gap-1.5">
        {SCREENS.map((s, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onGo(s.id)}
                disabled={!reachable[s.id] || active}
                aria-current={active ? "step" : undefined}
                className="w-full text-left disabled:cursor-default"
              >
                <span className={`relative block h-1 rounded-full ${done ? "bg-steel/60" : "bg-ink/10"}`}>
                  {active ? (
                    <motion.span
                      layoutId="step-active"
                      className="absolute inset-0 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  ) : null}
                </span>
                <span
                  className={`mt-2 block text-xs sm:text-sm ${
                    active ? "font-semibold text-ink" : reachable[s.id] ? "text-ink/70 hover:text-ink" : "text-muted"
                  }`}
                >
                  {i + 1}. {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      className="mt-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: EASE }}
    >
      {children}
    </motion.section>
  );
}

/** The heading cross-fades when its message changes (for example from "reviewing" to "blocked"). */
function Heading({ title, text }: { title: string; text: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink/70">{text}</p>
      </motion.div>
    </AnimatePresence>
  );
}

function Footer({ children, pinned = true }: { children: React.ReactNode; pinned?: boolean }) {
  return (
    <div
      className={`${pinned ? "sticky bottom-0 z-10 bg-bg/95 backdrop-blur" : ""} -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-3 sm:mx-0 sm:px-0`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg px-2 py-2.5 text-sm font-semibold text-steel hover:text-ink">
      {children}
    </button>
  );
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-sm font-semibold text-steel hover:text-ink"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {label}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function PolicyDrawer({ policy }: { policy: KnowledgeClaim[] }) {
  return (
    <Disclosure label={`The locked policy these must follow (${policy.length} rules)`}>
      <ol className="space-y-2.5 rounded-lg bg-surface p-4">
        {policy.map((c) => (
          <li key={c.id} className="flex gap-3 text-sm leading-relaxed text-ink/80">
            <span className="w-6 shrink-0 font-semibold text-steel">{c.id}</span>
            <span>{c.statement}</span>
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}

function ReviewerRow({
  name,
  model,
  state,
  summary,
  stub,
}: {
  name: string;
  model: string;
  state: "off" | "running" | "error" | "approve" | "object" | "idle";
  summary?: string;
  stub?: boolean;
}) {
  const status = {
    off: <span className="text-muted">Not configured</span>,
    idle: <span className="text-muted">Waiting</span>,
    running: (
      <span className="inline-flex items-center gap-1.5 text-steel">
        <Loader2 className="h-4 w-4 animate-spin" /> Reviewing
      </span>
    ),
    error: <span className="text-warn">Didn&apos;t respond</span>,
    approve: (
      <span className="inline-flex items-center gap-1 font-semibold text-good">
        <Check className="h-4 w-4" /> Approves
      </span>
    ),
    object: (
      <span className="inline-flex items-center gap-1 font-semibold text-bad">
        <X className="h-4 w-4" /> Objects
      </span>
    ),
  }[state];
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          <span className="font-semibold">{name}</span> <span className="text-muted">{model}</span>
          {stub ? <span className="ml-2 text-xs text-warn">test stub</span> : null}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="shrink-0"
          >
            {status}
          </motion.span>
        </AnimatePresence>
      </div>
      {summary && state !== "running" ? <p className="mt-1 text-sm leading-relaxed text-ink/70">{summary}</p> : null}
    </li>
  );
}

function ObjectionCard({
  objection,
  policy,
  suggestion,
  suggesting,
  disabled,
  onSuggest,
  onAccept,
  onDismiss,
  onEdit,
  onRemove,
}: {
  objection: Objection;
  policy: KnowledgeClaim[];
  suggestion: FixSuggestion | null;
  suggesting: boolean;
  disabled: boolean;
  onSuggest: () => void;
  onAccept: () => void;
  onDismiss: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const rules = policy.filter((p) => objection.policyRefs.includes(p.id));
  const objector = PROVIDER_LABEL[objection.raisedBy[0]];
  const hasSuggestion = Boolean(suggestion);

  useEffect(() => {
    if (!suggestion) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait for the panel to open before bringing it into view.
    const t = window.setTimeout(
      () => suggestionRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }),
      reduce ? 0 : 260
    );
    return () => window.clearTimeout(t);
  }, [suggestion]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="mt-6 overflow-hidden rounded-xl border border-bad/45 bg-surface shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-ink/10 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-bad">
          <AlertTriangle className="h-4 w-4" /> {objection.claim.id} is blocked
        </span>
        <span className="text-xs text-muted">
          Objected to by {listNames(objection.raisedBy.map((p) => PROVIDER_LABEL[p]))}
        </span>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <Label>{hasSuggestion ? "Current wording" : "The requirement"}</Label>
          <p className="mt-1.5 text-base leading-relaxed text-ink">{objection.claim.statement}</p>
        </section>

        {rules.length ? (
          <section>
            <Label>Why it&apos;s blocked</Label>
            <div className="mt-1.5 space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="border-l-[3px] border-bad pl-3">
                  <p className="text-sm font-semibold text-bad">Breaks policy {r.id}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-ink">{r.statement}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!hasSuggestion ? (
          <section>
            <Label>What the reviewers said</Label>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink/85">{objection.reasons[0].issue.detail}</p>
            {objection.reasons.length > 1 ? (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-steel hover:text-ink"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                Each reviewer in full
              </button>
            ) : null}
            <AnimatePresence initial={false}>
              {showDetails ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="overflow-hidden"
                >
                  <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink/85">
                    {objection.reasons.map((r, i) => (
                      <li key={i}>
                        <span className="font-semibold text-ink">{PROVIDER_LABEL[r.provider]}:</span> {r.issue.detail}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        ) : null}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {suggestion ? (
          <motion.div
            key="suggestion"
            ref={suggestionRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="scroll-mb-24 overflow-hidden"
          >
            <div className="border-t border-ink/10 p-5">
              <div className="border-l-[3px] border-good pl-3">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-good">
                  <Sparkles className="h-3.5 w-3.5" /> Suggested wording from {PROVIDER_LABEL[suggestion.provider]}
                  {suggestion.stub ? <span className="normal-case tracking-normal font-normal text-warn">(test stub)</span> : null}
                </p>
                <p className="mt-1.5 text-base leading-relaxed text-ink">
                  <Changed before={objection.claim.statement} after={suggestion.statement} />
                </p>
                {suggestion.explanation ? (
                  <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{suggestion.explanation}</p>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PrimaryButton onClick={onAccept}>
                  <Check className="h-4 w-4" /> Use this and review again
                </PrimaryButton>
                <SecondaryButton onClick={onDismiss}>Not this</SecondaryButton>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 px-5 py-4"
          >
            <PrimaryButton onClick={onSuggest} disabled={disabled}>
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {suggesting ? `Asking ${objector}` : `Ask ${objector} for a fix`}
            </PrimaryButton>
            <button
              type="button"
              onClick={onEdit}
              disabled={disabled}
              className="text-sm font-semibold text-steel hover:text-ink disabled:opacity-50"
            >
              Edit it myself
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="text-sm font-semibold text-steel hover:text-bad disabled:opacity-50"
            >
              Remove it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function SignerRow({
  signer,
  attestation,
  pending,
  onSign,
}: {
  signer: SignerView;
  attestation?: { decision: string; reasoning?: string; personalSignature?: unknown };
  pending?: "APPROVE" | "REJECT";
  onSign: (decision: "APPROVE" | "REJECT", comment?: string) => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const approved = attestation?.decision === "APPROVE";
  const rejected = attestation?.decision === "REJECT";

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={signer.name} role={signer.avatarRole} signed={approved} />
          <div>
            <p className="font-semibold">{signer.name}</p>
            <p className="text-sm text-muted">{signer.title}</p>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {approved ? (
            <motion.span
              key="signed"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="ml-[52px] inline-flex items-center gap-1 text-sm font-semibold text-good sm:ml-0"
            >
              <Check className="h-4 w-4" /> {attestation?.personalSignature ? "Signed off with passkey" : "Signed off"}
            </motion.span>
          ) : !signer.canSign ? (
            <span key="waiting" className="ml-[52px] text-sm text-muted sm:ml-0">
              {rejected ? "Asked for changes" : "Waiting for them"}
            </span>
          ) : !asking ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="ml-[52px] flex items-center gap-3 sm:ml-0"
            >
              <button
                type="button"
                onClick={() => setAsking(true)}
                disabled={Boolean(pending)}
                className="text-sm font-semibold text-steel hover:text-ink disabled:opacity-40"
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => onSign("APPROVE")}
                disabled={Boolean(pending)}
                aria-busy={pending === "APPROVE"}
                className="inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg border border-good/60 px-3 py-1.5 text-sm font-semibold text-good hover:bg-good/10 disabled:cursor-progress"
              >
                {pending === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {pending === "APPROVE" ? "Signing" : "Sign off"}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {rejected && attestation?.reasoning ? (
        <p className="mt-2 pl-[52px] text-sm text-bad">
          Requested changes: &ldquo;{attestation.reasoning}&rdquo;{attestation.personalSignature ? " (signed with passkey)" : ""}
        </p>
      ) : null}
      {asking ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:pl-[52px]">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={400}
            placeholder="What needs to change?"
            aria-label={`What ${signer.name} wants changed`}
            className="w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={async () => {
                if (await onSign("REJECT", comment)) {
                  setAsking(false);
                  setComment("");
                }
              }}
              disabled={Boolean(pending) || !comment.trim()}
              aria-busy={pending === "REJECT"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-bad px-3 py-2 text-sm font-semibold text-bg disabled:opacity-60"
            >
              {pending === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending === "REJECT" ? "Sending" : "Send"}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="px-2 text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Done({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      {ok ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-good" /> : <X className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
      <span className={ok ? "" : "text-ink/70"}>{children}</span>
    </li>
  );
}
