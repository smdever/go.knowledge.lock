"use client";

import { useState } from "react";
import { AlertTriangle, Check, Download, Loader2, MessageSquare, SearchCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { computeCanonicalPayloadHash, verifyKnowledgeLock, type KnowledgeLockBlock, type VerificationResult } from "@/lib/protocol";
import type { Api } from "@/lib/demo/client";
import { useKL } from "./KLContext";
import { Card, Pill, shortHash } from "./Shell";

function tamperedCopy(block: KnowledgeLockBlock): { copy: KnowledgeLockBlock; before: string; after: string; id: string } {
  const copy = JSON.parse(JSON.stringify(block)) as KnowledgeLockBlock;
  const target = copy.payload.claims.find((c) => c.statement.includes("one working day")) ?? copy.payload.claims[0];
  const before = target.statement;
  target.statement = before.includes("one working day")
    ? before.replace("one working day", "five working days")
    : `${before} (unless the team decides otherwise)`;
  return { copy, before, after: target.statement, id: target.id };
}

export function Verify({
  block,
  serverResult,
  authorityEphemeral,
}: {
  block: KnowledgeLockBlock;
  serverResult: VerificationResult;
  authorityEphemeral: boolean;
}) {
  const [result, setResult] = useState<VerificationResult & { where: string }>({ ...serverResult, where: "server" });
  const [busy, setBusy] = useState(false);
  const [tamper, setTamper] = useState<{ id: string; before: string; after: string; result: VerificationResult } | null>(null);

  async function verifyHere() {
    setBusy(true);
    setTamper(null);
    try {
      setResult({ ...(await verifyKnowledgeLock(block)), where: "your browser" });
    } catch {
      setResult({ ...serverResult, where: "server (your browser lacks Ed25519 support)" });
    }
    setBusy(false);
  }

  async function tryTamper() {
    setBusy(true);
    const t = tamperedCopy(block);
    try {
      setTamper({ id: t.id, before: t.before, after: t.after, result: await verifyKnowledgeLock(t.copy) });
    } catch {
      const computedHash = await computeCanonicalPayloadHash(t.copy.payload);
      setTamper({
        id: t.id,
        before: t.before,
        after: t.after,
        result: { ...serverResult, valid: false, tamperDetected: true, consensusSatisfied: false, computedHash, errors: [] },
      });
    }
    setBusy(false);
  }

  function download() {
    const blob = new Blob([JSON.stringify(block, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-lock-${block.lockId.slice(2, 14)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Verification</h2>
        {result.valid ? (
          <Pill tone="good"><ShieldCheck className="h-3 w-3" /> Valid</Pill>
        ) : (
          <Pill tone="bad"><ShieldAlert className="h-3 w-3" /> Failed</Pill>
        )}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        <Row ok={!result.tamperDetected} label="Content matches its fingerprint" failLabel="Content does not match its fingerprint" />
        <Row ok={result.consensusSatisfied} label="Sign-off rules met for this exact content" failLabel="Sign-off rules not met for this content" />
        <Row ok={result.signatureValid !== false} label="Lock signature valid" failLabel="Lock signature invalid" />
        {result.personalSignatures ? (
          <Row
            ok={result.personalSignatures.valid === result.personalSignatures.total}
            label={`${result.personalSignatures.total} personal passkey signature${result.personalSignatures.total === 1 ? "" : "s"} valid`}
            failLabel={`${result.personalSignatures.total - result.personalSignatures.valid} of ${result.personalSignatures.total} personal signatures invalid`}
          />
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-muted">Checked in {result.where}.</p>
      <dl className="mt-4 space-y-1 font-mono text-[11px] text-muted">
        <div className="flex justify-between gap-2"><dt>Fingerprint</dt><dd title={block.canonicalHash}>{shortHash(block.canonicalHash)}</dd></div>
        <div className="flex justify-between gap-2"><dt>Signed by</dt><dd title={block.signatures.signerPublicKey}>{block.signatures.signerPublicKey ? shortHash(block.signatures.signerPublicKey) : "—"}</dd></div>
      </dl>
      {authorityEphemeral ? (
        <p className="mt-2 text-[11px] text-warn">This server is using a temporary signing key.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={verifyHere} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold hover:border-ink/30 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Verify in your browser
        </button>
        <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold hover:border-ink/30">
          <Download className="h-3.5 w-3.5" /> Proof (JSON)
        </button>
      </div>

      <div className="mt-6 border-t border-ink/10 pt-5">
        <h3 className="text-sm font-semibold">What if someone edits it?</h3>
        <p className="mt-1 text-xs text-ink/70">Change one word in a copy of this record and check it again.</p>
        <button type="button" onClick={tryTamper} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-warn/60 px-3 py-1.5 text-xs font-semibold text-warn hover:bg-warn/5 disabled:opacity-50">
          <AlertTriangle className="h-3.5 w-3.5" /> Try a quiet edit
        </button>
        {tamper ? (
          <motion.div
            key={tamper.result.computedHash}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 space-y-3 rounded-xl border border-bad/40 bg-bad/5 p-3 text-xs"
          >
            <p className="leading-relaxed">
              <span className="font-mono font-semibold">{tamper.id}</span> changed to: <span className="italic">&ldquo;{tamper.after}&rdquo;</span>
            </p>
            <ul className="space-y-1.5">
              <Row ok={!tamper.result.tamperDetected} label="Content matches its fingerprint" failLabel="Fingerprint no longer matches" small />
              <Row ok={tamper.result.consensusSatisfied} label="Sign-offs still apply" failLabel="Sign-offs no longer apply" small />
            </ul>
            <p className="font-mono text-[11px] text-muted">
              Recorded {shortHash(block.canonicalHash)}
              <br />
              Now {shortHash(tamper.result.computedHash)}
            </p>
            <p className="text-ink/80">The edit is caught, and every sign-off stops counting because it was given for the original wording.</p>
          </motion.div>
        ) : null}
      </div>
    </Card>
  );
}

function Row({ ok, label, failLabel, small }: { ok: boolean; label: string; failLabel: string; small?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${small ? "text-xs" : ""}`}>
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
      <span className={ok ? "" : "text-bad"}>{ok ? label : failLabel}</span>
    </li>
  );
}

export function Build({ lockId, questions, sampleTicket }: { lockId: string; questions: string[]; sampleTicket: string }) {
  const { api } = useKL();
  const [tab, setTab] = useState<"ask" | "drift">("ask");
  const [question, setQuestion] = useState(questions[0] ?? "");
  const [answer, setAnswer] = useState<Awaited<ReturnType<Api["ask"]>> | null>(null);
  const [ticket, setTicket] = useState(sampleTicket);
  const [drift, setDrift] = useState<Awaited<ReturnType<Api["drift"]>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      setAnswer(await api.ask(lockId, question));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function check() {
    setBusy(true);
    setError("");
    setDrift(null);
    try {
      setDrift(await api.drift(lockId, ticket));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const tabClass = (t: string) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-accent text-white" : "text-ink/70 hover:text-ink"}`;

  return (
    <Card>
      <div className="inline-flex gap-1 rounded-xl border border-ink/10 p-1" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "ask"} className={tabClass("ask")} onClick={() => setTab("ask")}>
          <MessageSquare className="h-4 w-4" /> Ask the agent
        </button>
        <button type="button" role="tab" aria-selected={tab === "drift"} className={tabClass("drift")} onClick={() => setTab("drift")}>
          <SearchCheck className="h-4 w-4" /> Check a ticket
        </button>
      </div>

      {tab === "ask" ? (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {questions.map((q) => (
              <button key={q} type="button" onClick={() => setQuestion(q)} className="rounded-full border border-ink/15 px-3 py-1 text-xs hover:border-accent hover:text-accent">
                {q}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={400}
              aria-label="Question for the agent"
              placeholder="Ask what this record says about something"
              className="w-full rounded-lg border border-ink/15 bg-bg/70 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={ask} disabled={busy || !question.trim()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ask
            </button>
          </div>
          {answer ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 rounded-xl border border-ink/10 p-4"
            >
              {answer.stub ? <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-warn">Local test stub, not a real model</p> : null}
              {!answer.covered ? <Pill tone="warn">Not covered by the locked record</Pill> : null}
              <p className="mt-2 text-sm leading-relaxed">{answer.answer}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {answer.citations.length ? <span>Based on</span> : null}
                {answer.citations.map((c) => (
                  <span key={c} className="rounded-md border border-ink/15 px-1.5 py-0.5 font-mono text-ink">{c}</span>
                ))}
                <span className="ml-auto font-mono">{answer.model}</span>
              </div>
            </motion.div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5">
          <label htmlFor="ticket" className="text-xs font-semibold text-ink/70">A ticket from the delivery backlog</label>
          <textarea
            id="ticket"
            value={ticket}
            placeholder="Paste a ticket, user story or spec to check against this record"
            onChange={(e) => setTicket(e.target.value)}
            rows={8}
            maxLength={4000}
            className="mt-1 w-full rounded-lg border border-ink/15 bg-bg/70 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-accent"
          />
          <button type="button" onClick={check} disabled={busy || !ticket.trim()} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />} Check for drift
          </button>
          {drift ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 space-y-3"
            >
              {drift.stub ? <p className="font-mono text-[10px] uppercase tracking-wider text-warn">Local test stub, not a real model</p> : null}
              <p className="text-sm">{drift.summary}</p>
              {drift.findings.length === 0 ? <Pill tone="good"><Check className="h-3 w-3" /> Matches what was agreed</Pill> : null}
              <ul className="space-y-3">
                {drift.findings.map((f, i) => (
                  <li key={i} className={`rounded-xl border p-3 text-sm ${f.kind === "departs" ? "border-bad/40 bg-bad/5" : "border-warn/40 bg-warn/5"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={f.kind === "departs" ? "bad" : "warn"}>{f.kind === "departs" ? "Departs from" : "Not covered"}</Pill>
                      {f.requirementId !== "none" ? <span className="font-mono text-xs font-semibold">{f.requirementId}</span> : null}
                    </div>
                    <p className="mt-2 text-xs italic text-ink/75">&ldquo;{f.excerpt}&rdquo;</p>
                    <p className="mt-1.5 text-xs leading-relaxed">{f.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="text-right font-mono text-xs text-muted">{drift.model}</p>
            </motion.div>
          ) : null}
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
    </Card>
  );
}

