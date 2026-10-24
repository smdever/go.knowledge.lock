"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { inputClass } from "./forms";

interface Candidate {
  userId: string;
  name: string;
  title: string;
  email: string;
}

export default function NewRecordForm({
  kind,
  candidates,
  meId,
  maxClaims,
}: {
  kind: "requirements" | "policy";
  candidates: Candidate[];
  meId: string;
  maxClaims: number;
}) {
  const router = useRouter();
  const policy = kind === "policy";
  const [title, setTitle] = useState(policy ? "Organisation policy" : "");
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<string[]>(() => candidates.map((c) => c.userId));
  const [quorum, setQuorum] = useState(candidates.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const statements = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const q = Math.min(quorum, Math.max(1, chosen.length));

  function toggle(id: string) {
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    setChosen(next);
    // Keep "everyone" meaning everyone when the list changes.
    if (quorum >= chosen.length || quorum > next.length) setQuorum(next.length);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/app/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, statements, signerIds: chosen, quorum: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/app/r/${data.record.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <label htmlFor="title" className="block text-sm font-semibold">Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          placeholder={policy ? "" : "e.g. AI assistant for customer complaints: requirements"}
          className={`mt-2 ${inputClass}`}
        />
      </div>

      <div>
        <label htmlFor="statements" className="block text-sm font-semibold">
          {policy ? "Rules, one per line" : "What needs agreeing, one statement per line"}
        </label>
        <p className="mt-1 text-sm text-ink/70">
          {policy
            ? "Each line becomes a numbered rule (P1, P2…) that future records are checked against."
            : "Each line becomes a numbered statement (R1, R2…). Short, separate statements are easier to review and sign off."}
        </p>
        <textarea
          id="statements"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className={`mt-2 ${inputClass} leading-relaxed`}
        />
        <p className={`mt-1 text-xs ${statements.length > maxClaims ? "text-bad" : "text-muted"}`}>
          {statements.length} of up to {maxClaims} lines
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Who signs it off</legend>
        <p className="mt-1 text-sm text-ink/70">Only owners and signers can be chosen. Each person signs from their own account.</p>
        <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {candidates.map((c) => (
            <li key={c.userId}>
              <label className="flex cursor-pointer items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={chosen.includes(c.userId)}
                  onChange={() => toggle(c.userId)}
                  className="h-4 w-4 accent-[var(--text-accent)]"
                />
                <Avatar name={c.name} size={32} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {c.name} {c.userId === meId ? <span className="text-xs font-normal text-muted">(you)</span> : null}
                  </span>
                  <span className="block truncate text-sm text-ink/70">{[c.title, c.email].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <label htmlFor="quorum" className="block text-sm font-semibold">How many must approve</label>
        <div className="mt-2 flex items-center gap-3">
          <select
            id="quorum"
            value={q}
            onChange={(e) => setQuorum(Number(e.target.value))}
            disabled={chosen.length === 0}
            className={`${inputClass} w-auto`}
          >
            {Array.from({ length: Math.max(1, chosen.length) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === chosen.length ? `All ${n}` : `${n} of ${chosen.length}`}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink/70">An objection from anyone still blocks the lock.</span>
        </div>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad/40 bg-surface px-3 py-2.5 text-sm text-bad">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !chosen.length || !statements.length || statements.length > maxClaims}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create draft
      </button>
    </form>
  );
}
