"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";

async function call(url: string, method: "POST" | "DELETE", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; draftsArchived?: number };
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/** Owners only: take a locked record out of use, with a reason everyone will see. */
export function RetireForm({ lockId, version }: { lockId: string; version: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retire() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/app/locks/${lockId}/retire`, "POST", { reason });
      router.refresh();
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/40"
      >
        <Archive className="h-4 w-4" /> Retire this record
      </button>
    );

  return (
    <div className="rounded-xl border border-ink/15 bg-surface p-4 sm:p-5">
      <label htmlFor="retire-reason" className="text-sm font-semibold">
        Why is it being retired?
      </label>
      <p className="mt-1 text-sm text-ink/70">
        Everyone who opens v{version}, any linked Jira issue and any agent that asks for it will see this.
      </p>
      <textarea
        id="retire-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={400}
        rows={3}
        placeholder="For example: The complaints assistant was withdrawn in October."
        className="mt-3 w-full rounded-lg border border-ink/20 bg-bg px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-accent"
      />
      {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={retire}
          disabled={busy || !reason.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Retiring" : "Retire it"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-sm font-semibold text-steel hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Owners only: put a retired record back in use. */
export function RestoreLockButton({ lockId }: { lockId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function restore() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/app/locks/${lockId}/retire`, "DELETE");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={restore}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-bg px-3.5 py-1.5 text-sm font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
        {busy ? "Restoring" : "Restore it"}
      </button>
      {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
    </div>
  );
}

/** A draft's creator or an owner: archive it, or bring it back. */
export function ArchiveDraftButton({ recordId, archived, compact }: { recordId: string; archived: boolean; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/app/records/${recordId}/archive`, archived ? "DELETE" : "POST");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : archived ? ArchiveRestore : Archive;
  return (
    <span className={compact ? "inline-flex flex-col items-end" : "block"}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={
          compact
            ? "inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-ink disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-bg px-3.5 py-1.5 text-sm font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
        }
      >
        <Icon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {archived ? (busy ? "Restoring" : "Restore draft") : busy ? "Archiving" : "Archive draft"}
      </button>
      {error ? <span className="mt-1 block text-sm text-bad">{error}</span> : null}
    </span>
  );
}
