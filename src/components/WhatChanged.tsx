"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, GitCompareArrows, Sparkles, X } from "lucide-react";
import type { DemoRecord, ProviderId } from "@/lib/demo/types";
import { changesFromResolutions, compareWording, type LineChange, type Why } from "@/lib/diff";

const PROVIDER: Record<ProviderId, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" };
const names = (list: string[]) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

const LABEL: Record<LineChange["kind"], string> = { unchanged: "Unchanged", reworded: "Reworded", removed: "Removed", added: "Added" };
const PILL: Record<LineChange["kind"], string> = {
  unchanged: "border-ink/25 text-ink/70",
  reworded: "border-steel/60 text-steel",
  removed: "border-bad/50 text-bad",
  added: "border-good/50 text-good",
};

/**
 * On the sign-off step: compares the wording being signed with the original (the wording first sent for AI
 * review, or the previous locked version). Information only; it doesn't change what is signed.
 */
export default function WhatChanged({ record }: { record: Pick<DemoRecord, "baseline" | "payload" | "resolutions" | "version"> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [showSame, setShowSame] = useState(false);
  const full = Boolean(record.baseline);
  const changes = useMemo(
    () =>
      record.baseline
        ? compareWording(record.baseline.claims, record.payload.claims, record.resolutions ?? [])
        : changesFromResolutions(record.resolutions ?? [], record.payload.claims),
    [record.baseline, record.payload.claims, record.resolutions]
  );
  const count = (k: LineChange["kind"]) => changes.filter((c) => c.kind === k).length;
  const changed = changes.filter((c) => c.kind !== "unchanged");
  const same = changes.filter((c) => c.kind === "unchanged");
  const summary = (["reworded", "removed", "added"] as const)
    .filter((k) => count(k))
    .map((k) => `${count(k)} ${LABEL[k].toLowerCase()}`)
    .join(", ");
  const against =
    record.baseline?.source === "previous-version"
      ? `Comparing locked v${record.version - 1} with this draft, v${record.version}.`
      : full
        ? "Comparing the wording first sent for AI review with the wording you're signing."
        : "This draft was started before full comparisons were added, so only lines changed because an AI reviewer objected are shown.";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowSame(false);
          dialog.current?.showModal();
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink/20 px-3.5 py-2 text-sm font-semibold hover:border-ink/40"
      >
        <GitCompareArrows className="h-4 w-4" />
        See what changed
        <span className="font-normal text-ink/70">{summary ? `(${summary})` : "(no changes)"}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="what-changed-title"
        onClick={(e) => {
          // A click on the backdrop closes it.
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-ink/15 bg-bg p-0 text-ink shadow-[0_20px_60px_rgba(41,50,65,0.25)] backdrop:bg-[#293241]/50"
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4 sm:px-6">
            <div>
              <h2 id="what-changed-title" className="text-lg font-semibold">What changed</h2>
              <p className="mt-0.5 text-sm text-ink/70">{against}</p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="rounded-md p-1.5 text-ink/70 hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 sm:px-6">
            {full ? (
              <p className="text-sm text-ink/70">
                {[summary, same.length ? `${same.length} unchanged` : ""].filter(Boolean).join(", ") || "Nothing has changed."}
              </p>
            ) : null}
            {changed.length ? (
              <ol className="mt-3 space-y-3">
                {changed.map((c, i) => (
                  <Change key={i} c={c} />
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[15px]">
                {full
                  ? record.baseline?.source === "previous-version"
                    ? "The wording is the same as the previous locked version."
                    : "The wording is exactly what was first sent for review."
                  : "No lines were changed because of a reviewer's objection."}
              </p>
            )}

            {full && same.length ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowSame(!showSame)}
                  aria-expanded={showSame}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-ink"
                >
                  <ChevronDown className={`h-4 w-4 transition ${showSame ? "rotate-180" : ""}`} />
                  {showSame ? "Hide" : "Show"} {same.length} unchanged line{same.length === 1 ? "" : "s"}
                </button>
                {showSame ? (
                  <ol className="mt-3 space-y-3">
                    {same.map((c, i) => (
                      <Change key={i} c={c} />
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-ink/10 px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              Back to sign-off
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Change({ c }: { c: LineChange }) {
  const ids = c.kind === "reworded" ? (c.fromId === c.toId ? c.toId : `${c.fromId} → ${c.toId}`) : c.id;
  return (
    <li className="rounded-xl border border-ink/10 bg-surface p-3.5 text-[15px] leading-relaxed sm:p-4">
      <p className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${PILL[c.kind]}`}>{LABEL[c.kind]}</span>
        <span className="text-sm font-semibold text-ink/70">{ids}</span>
      </p>
      <p className="mt-2">
        {c.kind === "reworded" ? (
          c.words.map((w, i) =>
            w.type === "same" ? (
              <span key={i}>{w.text}</span>
            ) : w.type === "del" ? (
              <del key={i} className="text-bad decoration-bad/70 decoration-2">
                <span className="sr-only">Taken out: </span>
                {w.text}
              </del>
            ) : (
              <ins key={i} className="font-semibold text-good underline decoration-good/70 decoration-2 underline-offset-2">
                <span className="sr-only">Put in: </span>
                {w.text}
              </ins>
            )
          )
        ) : c.kind === "removed" ? (
          <del className="text-ink/80 decoration-ink/40">{c.statement}</del>
        ) : (
          <span className={c.kind === "unchanged" ? "text-ink/80" : ""}>{c.statement}</span>
        )}
      </p>
      {c.kind === "reworded" || c.kind === "removed" ? <Reason why={c.why} removed={c.kind === "removed"} /> : null}
    </li>
  );
}

function Reason({ why, removed }: { why?: Why; removed: boolean }) {
  if (!why) return <p className="mt-2 text-sm text-ink/70">{removed ? "Removed by a person, not because of a reviewer's objection." : "Changed by a person, not because of a reviewer's objection."}</p>;
  return (
    <div className="mt-2 space-y-1 text-sm text-ink/80">
      <p>
        <span className="font-semibold">{names(why.raisedBy.map((p) => PROVIDER[p]))} objected to the original</span>
        {why.issues[0]?.policyRef ? ` (it broke ${why.issues[0].policyRef})` : ""}.
      </p>
      {why.issues.slice(0, 3).map((i, k) => (
        <p key={k} className="text-ink/70">
          {PROVIDER[i.provider]}: {i.detail}
        </p>
      ))}
      {why.suggestedBy ? (
        <p className="inline-flex items-center gap-1.5 text-ink/80">
          <Sparkles className="h-3.5 w-3.5" /> The new wording is {PROVIDER[why.suggestedBy]}&apos;s suggestion.
        </p>
      ) : null}
    </div>
  );
}
