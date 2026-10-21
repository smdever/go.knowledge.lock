"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Compass, X } from "lucide-react";

export type TourStep =
  | "welcome"
  | "send"
  | "reviewing"
  | "objection"
  | "suggesting"
  | "suggestion"
  | "rereviewing"
  | "approved"
  | "approved-after-fix"
  | "signing"
  | "lock"
  | "locked"
  | "tampered"
  | "build"
  | "done";

type LockStep = Extract<TourStep, "locked" | "tampered" | "build" | "done">;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";
const STORAGE_KEY = "kl-tour-v1";

const PHASE: Record<TourStep, string> = {
  welcome: "Propose",
  send: "Propose",
  reviewing: "Review",
  objection: "Review",
  suggesting: "Review",
  suggestion: "Review",
  rereviewing: "Review",
  approved: "Review",
  "approved-after-fix": "Review",
  signing: "Review",
  lock: "Lock",
  locked: "Lock",
  tampered: "Lock",
  build: "Build from it",
  done: "Build from it",
};

const STEPS: Record<TourStep, { target: string; title: string; body: string; next?: boolean }> = {
  welcome: {
    target: "add-risky",
    title: "A draft that needs agreeing",
    body: "Halden Bank's teams have drafted requirements for an AI complaints assistant. The policy it must follow is already locked (shown alongside). Add a requirement that quietly breaks it, and see what happens.",
  },
  send: {
    target: "send",
    title: "Send it for review",
    body: "Three models from different providers will check every requirement against the locked policy, independently of each other.",
  },
  reviewing: {
    target: "models",
    title: "Independent review",
    body: "Each model reads the draft and the locked policy, then reports conflicts, ambiguity and gaps. This takes a few seconds.",
  },
  objection: {
    target: "suggest-fix",
    title: "Blocked: a policy conflict",
    body: "The models flagged a requirement that contradicts the locked policy. Nothing can be locked while an objection stands. Ask the model that objected to suggest a fix.",
  },
  suggesting: {
    target: "objection",
    title: "Asking for a fix",
    body: "The model that objected is drafting wording that keeps the intent but respects the policy.",
  },
  suggestion: {
    target: "suggestion",
    title: "You stay in control",
    body: "Accept the new wording and it goes straight back for review, or dismiss it and edit the requirement yourself.",
  },
  rereviewing: {
    target: "models",
    title: "Checking the new wording",
    body: "Every model reviews the revised draft from scratch. Earlier reviews no longer count, because they were given for different wording.",
  },
  approved: {
    target: "stakeholders",
    title: "The models approve",
    body: "Now the people. Sign off as Product, Compliance and Engineering. Tip: add the policy-breaking requirement first to see how an objection is handled.",
  },
  "approved-after-fix": {
    target: "stakeholders",
    title: "Objection resolved",
    body: "All the models approve the new wording, and how the objection was resolved will be recorded in the lock. Now the people: sign off as Product, Compliance and Engineering.",
  },
  signing: {
    target: "stakeholders",
    title: "Sign-off",
    body: "Each person signs off on this exact wording. All three are needed, and any edit would reset them.",
  },
  lock: {
    target: "lock-button",
    title: "Ready to lock",
    body: "Every rule is met. Locking fingerprints this exact version, signs it and stores it so it can't be quietly changed.",
  },
  locked: {
    target: "verify",
    title: "Locked and verifiable",
    body: "Anyone with the link can check this record hasn't changed. Try a quiet edit to see what happens if someone tampers with it.",
  },
  tampered: {
    target: "verify",
    title: "Caught",
    body: "Changing one word breaks the fingerprint, and every sign-off stops counting. Next, put the record to work.",
    next: true,
  },
  build: {
    target: "build",
    title: "Build from it",
    body: "Agents and teams work from this version only. Ask the agent a question, or check a backlog ticket for drift.",
  },
  done: {
    target: "propose",
    title: "That's Knowledge Lock",
    body: "Need a change? Propose a change creates version 2. It goes back through review and replaces this one once locked.",
  },
};

// Whether the visitor has finished or skipped the tour, kept in localStorage (per browser).
const SSR = "ssr";
const CHANGE_EVENT = "kl-tour-storage";

function readSeen(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeSeen(value: "done" | "skipped" | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Tells the tour about something the visitor did on the lock page. */
export function tourEvent(name: "tampered" | "answered") {
  window.dispatchEvent(new CustomEvent("kl-tour", { detail: name }));
}

export default function Tour(props: { page: "workspace"; step: TourStep } | { page: "lock"; isNew: boolean }) {
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => SSR);
  const [restarted, setRestarted] = useState(false);
  const [lockStep, setLockStep] = useState<LockStep>("locked");
  const lastStep = useRef<TourStep | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Starts automatically for first-time visitors; on a lock page only when arriving from the flow.
  const ready = seen !== SSR;
  const active = ready && !seen && (restarted || props.page === "workspace" || props.isNew);

  useEffect(() => {
    if (props.page !== "lock") return;
    const onEvent = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      setLockStep((s) => (name === "tampered" && s === "locked" ? "tampered" : name === "answered" && s === "build" ? "done" : s));
    };
    window.addEventListener("kl-tour", onEvent);
    return () => window.removeEventListener("kl-tour", onEvent);
  }, [props.page]);

  const step: TourStep = props.page === "workspace" ? props.step : lockStep;
  const content = STEPS[step];

  // Highlight the target and bring it into view when the step changes.
  useEffect(() => {
    document.querySelectorAll("[data-tour-highlight]").forEach((el) => el.removeAttribute("data-tour-highlight"));
    if (!active) return;
    const el = document.querySelector(`[data-tour="${content.target}"]`);
    if (!el) return;
    el.setAttribute("data-tour-highlight", "");
    // Keep the panel clear of the target: on wide screens put it on the opposite side.
    const rect = el.getBoundingClientRect();
    if (panel.current) panel.current.dataset.side = rect.left + rect.width / 2 > window.innerWidth / 2 ? "left" : "right";
    if (lastStep.current !== step) {
      lastStep.current = step;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Place the target in the upper part of the screen, above the panel (which sits at the bottom on phones).
      const offset = rect.height > window.innerHeight * 0.45 ? 80 : window.innerHeight * 0.25;
      window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - offset), behavior: reduce ? "auto" : "smooth" });
    }
  });

  function close(how: "done" | "skipped") {
    writeSeen(how);
    setRestarted(false);
    document.querySelectorAll("[data-tour-highlight]").forEach((el) => el.removeAttribute("data-tour-highlight"));
  }

  function restart() {
    lastStep.current = null;
    if (props.page === "lock") setLockStep("locked");
    setRestarted(true);
    writeSeen(null);
  }

  if (!ready) return null;

  if (!active) {
    return (
      <button
        type="button"
        onClick={restart}
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-bg/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur hover:border-accent hover:text-accent"
      >
        <Compass className="h-4 w-4" /> Guided tour
      </button>
    );
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-live="polite"
      aria-label="Guided tour"
      data-side="right"
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-accent/40 bg-bg/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-md sm:inset-x-auto sm:bottom-5 sm:w-[360px] sm:p-5 sm:data-[side=left]:left-5 sm:data-[side=right]:right-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
          Guided tour · {PHASE[step]}
        </span>
        <button
          type="button"
          onClick={() => close("skipped")}
          aria-label="Close the tour"
          className="rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <h2 className="mt-2 font-bold">{content.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{content.body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => close("skipped")} className="text-xs text-muted hover:text-ink">
          Explore freely
        </button>
        {content.next ? (
          <button
            type="button"
            onClick={() => setLockStep("build")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : step === "done" ? (
          <div className="flex items-center gap-2">
            <a href={`${SITE_URL}/#get-started`} className="text-xs font-semibold text-accent hover:underline">
              Talk to us
            </a>
            <button
              type="button"
              onClick={() => close("done")}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              Finish
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
