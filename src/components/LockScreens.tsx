"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Bot, Check, KeyRound, Lock, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { KnowledgeLockBlock, VerificationResult } from "@/lib/protocol";
import type { ProviderId, Resolution } from "@/lib/demo/types";
import { Build, Verify } from "./LockTools";
import StartButton from "./StartButton";
import Avatar from "./Avatar";
import { useKL } from "./KLContext";
import JiraPanel from "./app/JiraPanel";
import { RestoreLockButton, RetireForm } from "./app/RetireControls";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";
const APP_URL = (process.env.NEXT_PUBLIC_KL_APP_URL || "https://app.knowledge-lock.com").replace(/\/$/, "");
const PROVIDER_NAMES: Record<ProviderId, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" };

type Tab = "record" | "verify" | "build";

const fmtDay = (ms: number) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(ms);

const fmt = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(ms);

export default function LockScreens({
  block,
  verification,
  supersededBy,
  isPolicy,
  policyLockId,
  authorityEphemeral,
  isNew,
  questions,
  sampleTicket,
  canPropose = true,
  retired = null,
  canRetire = false,
}: {
  block: KnowledgeLockBlock;
  verification: VerificationResult;
  supersededBy: string | null;
  isPolicy: boolean;
  policyLockId: string;
  authorityEphemeral: boolean;
  isNew: boolean;
  questions: string[];
  sampleTicket: string;
  /** Product viewers can read and verify a lock but not start a new version. */
  canPropose?: boolean;
  /** Product only: set when an owner has taken this record out of use. */
  retired?: { at: number; by: string; reason: string } | null;
  /** Product owners can retire a current record, or restore a retired one. */
  canRetire?: boolean;
}) {
  const { mode, lockPath } = useKL();
  const product = mode === "app";
  const [tab, setTab] = useState<Tab>("record");
  const version = Number(block.payload.metadata?.version ?? 1);
  const resolutions = (block.payload.metadata?.resolutions as Resolution[] | undefined) ?? [];
  const people = block.consensus.attestations.filter((a) => a.attestorType === "human");
  const models = block.consensus.attestations.filter((a) => a.attestorType === "model");
  const tabs: { id: Tab; label: string }[] = isPolicy
    ? [
        { id: "record", label: "The policy" },
        { id: "verify", label: "Verify it" },
      ]
    : [
        { id: "record", label: "The record" },
        { id: "verify", label: "Verify it" },
        { id: "build", label: "Build from it" },
      ];

  function go(next: Tab) {
    setTab(next);
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto max-w-[680px]">
      {retired ? (
        <div role="status" className="mb-6 rounded-lg border border-warn/50 bg-surface px-4 py-3 text-sm leading-relaxed">
          <p className="flex items-center gap-2 font-semibold text-warn">
            <Archive className="h-4 w-4 shrink-0" /> Retired on {fmtDay(retired.at)} by {retired.by}
          </p>
          <p className="mt-1 text-ink/80">
            This is no longer the signed-off version. The agent, Jira checks and the API won&apos;t use it. It still verifies, so
            you can show exactly what was agreed.
          </p>
          <p className="mt-2">
            <span className="font-semibold">Reason:</span> {retired.reason}
          </p>
          {canRetire ? <RestoreLockButton lockId={block.lockId} /> : null}
        </div>
      ) : null}
      {supersededBy ? (
        <p className="mb-6 rounded-lg border border-warn/40 bg-surface px-3 py-2.5 text-sm text-warn">
          A newer version has replaced this one.{" "}
          <Link href={lockPath(supersededBy)} className="font-semibold underline">
            Open the current version
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {retired ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-warn">
            <Archive className="h-4 w-4" /> Retired v{version}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
            <Lock className="h-4 w-4" /> {isPolicy ? "Locked policy" : `Locked v${version}`}
          </p>
        )}
        <p className="text-sm text-muted">Locked {fmt(block.lockedAt)}</p>
      </div>

      <div role="tablist" aria-label="Locked record" className="mt-5 grid grid-flow-col gap-1.5">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => go(t.id)}
              className="text-left"
            >
              <span className="relative block h-1 rounded-full bg-ink/10">
                {active ? (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute inset-0 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                ) : null}
              </span>
              <span className={`mt-2 block text-xs sm:text-sm ${active ? "font-semibold" : "text-ink/70 hover:text-ink"}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
      {tab === "record" ? (
        <Panel key="record">
          <Heading
            title={isNew ? "Locked. This is now the signed-off version" : block.payload.title}
            text={
              isPolicy
                ? product
                  ? "Your organisation's locked policy. Every new record is checked against it."
                  : "The bank's complaints policy, seeded for this demo. New requirements are checked against it."
                : product
                  ? "Teams and AI agents work from exactly this wording. Everyone in your organisation sees the same version."
                  : "Teams and AI agents work from exactly this wording. Anyone with the link sees the same version."
            }
          />
          <ol className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {block.payload.claims.map((c) => (
              <li key={c.id} className="flex gap-3 py-3 text-[15px] leading-relaxed">
                <span className="w-7 shrink-0 text-sm font-semibold text-steel">{c.id}</span>
                <span>{c.statement}</span>
              </li>
            ))}
          </ol>

          {resolutions.length ? (
            <div className="mt-8">
              <h2 className="text-lg font-semibold">
                {resolutions.length === 1 ? "One objection was resolved" : `${resolutions.length} objections were resolved`} before
                locking
              </h2>
              <p className="mt-1 text-sm text-ink/70">This history is part of the signed record, so it can&apos;t be rewritten.</p>
              <ul className="mt-4 space-y-4">
                {resolutions.map((r, i) => (
                  <li key={i} className="rounded-xl border border-ink/10 bg-surface p-4 text-sm leading-relaxed">
                    <p className="text-xs font-semibold uppercase tracking-wider text-steel">Original wording</p>
                    <p className="mt-1 text-ink/80">{r.originalStatement}</p>
                    <p className="mt-2 text-bad">
                      {listNames(r.raisedBy.map((p) => PROVIDER_NAMES[p]))} objected
                      {r.issues[0]?.policyRef ? `: it broke ${r.issues[0].policyRef}` : ""}.
                    </p>
                    <p className="mt-1 text-good">
                      {r.outcome === "removed"
                        ? "Removed, then re-reviewed and approved."
                        : `Reworded${r.suggestedBy ? ` using ${PROVIDER_NAMES[r.suggestedBy]}'s suggestion` : ""}, then re-reviewed and approved:`}
                    </p>
                    {r.newStatement ? <p className="mt-1">{r.newStatement}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <h2 className="text-lg font-semibold">Who agreed</h2>
            <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10 text-sm">
              {people.map((a) => (
                <Agreed
                  key={a.attestationId}
                  icon={<Avatar name={a.attestorId} role={a.role} size={28} />}
                  name={a.attestorId}
                  ok={a.decision === "APPROVE"}
                  note={a.personalSignature ? "Signed with their own passkey" : undefined}
                />
              ))}
              {models.map((a) => (
                <Agreed
                  key={a.attestationId}
                  icon={
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5">
                      <Bot className="h-4 w-4" />
                    </span>
                  }
                  name={`${PROVIDER_NAMES[a.provider as ProviderId] ?? a.provider} (${a.attestorId})${a.isLive === false ? ", test stub" : ""}`}
                  ok={a.decision === "APPROVE"}
                />
              ))}
            </ul>
          </div>

          <Footer>
            {block.parentLockId ? (
              <Link href={lockPath(block.parentLockId)} className="px-2 py-2.5 text-sm font-semibold text-steel hover:text-ink">
                See v{version - 1}
              </Link>
            ) : !isPolicy && policyLockId ? (
              <Link href={lockPath(policyLockId)} className="px-2 py-2.5 text-sm font-semibold text-steel hover:text-ink">
                See the policy
              </Link>
            ) : (
              <span />
            )}
            <Primary onClick={() => go("verify")}>Next: verify it</Primary>
          </Footer>
        </Panel>
      ) : null}

      {tab === "verify" ? (
        <Panel key="verify">
          <Heading
            title="Anyone can check it hasn't changed"
            text="Run the check in your browser, then try changing a single word in a copy and see what happens."
          />
          <div className="mt-6">
            <Verify block={block} serverResult={verification} authorityEphemeral={authorityEphemeral} />
          </div>
          <Footer>
            <Secondary onClick={() => go("record")}>Back</Secondary>
            {isPolicy ? (
              product ? (
                !supersededBy && canPropose ? <StartButton parentLockId={block.lockId} label="Propose a new version" /> : <span />
              ) : (
                <StartButton label="Start the demo" />
              )
            ) : (
              <Primary onClick={() => go("build")}>Next: build from it</Primary>
            )}
          </Footer>
        </Panel>
      ) : null}

      {tab === "build" ? (
        <Panel key="build">
          {retired ? (
            <Heading
              title="This record is retired, so nothing is built from it"
              text="The agent won't answer questions from it, and tickets and Jira issues aren't checked against it. An owner can restore it if it's needed again."
            />
          ) : (
            <>
              <Heading
                title="Teams and AI agents work from this version only"
                text="Ask the agent a question, or check a backlog ticket against what was agreed."
              />
              <div className="mt-6">
                <Build lockId={block.lockId} questions={questions} sampleTicket={sampleTicket} />
              </div>
            </>
          )}

          {product && !isPolicy && !retired ? (
            <div className="mt-10 border-t border-ink/10 pt-8">
              <h2 className="text-lg font-semibold">Jira</h2>
              <p className="mt-1 max-w-[60ch] text-[15px] leading-relaxed text-ink/70">
                Check Jira issues against this record, and create issues from it.
              </p>
              <div className="mt-4">
                <JiraPanel lockId={block.lockId} claimCount={block.payload.claims.length} />
              </div>
            </div>
          ) : null}

          <div className="mt-10 border-t border-ink/10 pt-8">
            {!supersededBy && !retired && canPropose ? (
              <>
                <h2 className="text-lg font-semibold">Need to change something?</h2>
                <p className="mt-1 max-w-[60ch] text-[15px] leading-relaxed text-ink/70">
                  Locked records are never edited. A change becomes version {version + 1}, goes back through review, and replaces
                  this one once it&apos;s locked.
                </p>
                <div className="mt-4">
                  <StartButton parentLockId={block.lockId} label="Propose a change" />
                </div>
              </>
            ) : null}
            {product && canRetire && !supersededBy && !retired && !isPolicy ? (
              <div className={canPropose ? "mt-10" : ""}>
                <h2 className="text-lg font-semibold">Take it out of use</h2>
                <p className="mt-1 max-w-[60ch] text-[15px] leading-relaxed text-ink/70">
                  Retire it, and it stops being the signed-off version. The agent, Jira checks and the API stop using it, but the
                  lock still verifies and stays in your records. You can restore it later.
                </p>
                <div className="mt-4">
                  <RetireForm lockId={block.lockId} version={version} />
                </div>
              </div>
            ) : null}
            {!product ? (
              <div className="mt-8 rounded-2xl border border-accent/35 bg-accent/[0.06] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">That&apos;s Knowledge Lock. Now try it for real.</h2>
                <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-ink/75">
                  In the app, your own team signs in and each person signs off for themselves, with an optional passkey. You
                  also get Slack and Teams notices, and an API so your AI agents work from what you locked.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <a href={`${APP_URL}/request-access`} className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover">
                    Request access
                  </a>
                  <a href={`${APP_URL}/signin`} className="text-sm font-semibold text-steel hover:text-ink">
                    Sign in to the app
                  </a>
                  <a href={`${SITE_URL}/#get-started`} className="text-sm font-semibold text-steel hover:text-ink">
                    Talk to us about a pilot
                  </a>
                </div>
              </div>
            ) : null}
          </div>
          <Footer>
            <Secondary onClick={() => go("verify")}>Back</Secondary>
            <span />
          </Footer>
        </Panel>
      ) : null}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      className="mt-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
      <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink/70">{text}</p>
    </div>
  );
}

function Agreed({ icon, name, ok, note }: { icon: React.ReactNode; name: string; ok: boolean; note?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2.5 text-ink/85">
        <span className="text-muted">{icon}</span>
        <span>
          {name}
          {note ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <KeyRound className="h-3 w-3" /> {note}
            </span>
          ) : null}
        </span>
      </span>
      {ok ? (
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-good">
          <Check className="h-4 w-4" /> Approved
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-bad">
          <X className="h-4 w-4" /> Objected
        </span>
      )}
    </li>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-ink/10 bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
      {children}
    </div>
  );
}

function Primary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg px-2 py-2.5 text-sm font-semibold text-steel hover:text-ink">
      {children}
    </button>
  );
}
