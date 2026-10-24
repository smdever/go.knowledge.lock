"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Info, Loader2, Plus } from "lucide-react";
import { request } from "@/lib/demo/client";

type Status = "clear" | "departs" | "not_covered" | "created" | "error";

interface JiraLink {
  id: string;
  issueKey: string;
  issueUrl: string;
  summary: string;
  lockId: string;
  claimId: string | null;
  status: Status;
  resultSummary: string;
  findings: { requirementId: string; kind: string; detail: string; excerpt: string }[];
  checkedAt: string | null;
  checkedBy: string | null;
  auto: boolean;
}

type Panel =
  | { connected: false }
  | { connected: true; site: string; autoCheck: boolean; canEdit: boolean; current: boolean; latestLockId: string; links: JiraLink[] };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));

function StatusPill({ link }: { link: JiraLink }) {
  const departs = link.findings.filter((f) => f.kind === "departs").length;
  const map: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
    clear: { label: "Matches", cls: "border-good/40 text-good", icon: <Check className="h-3.5 w-3.5" /> },
    departs: { label: `Departs (${departs})`, cls: "border-bad/50 text-bad", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    not_covered: { label: "Adds things not agreed", cls: "border-warn/50 text-warn", icon: <Info className="h-3.5 w-3.5" /> },
    created: { label: link.claimId ? `Created from ${link.claimId}` : "Created", cls: "border-steel/40 text-steel", icon: <Plus className="h-3.5 w-3.5" /> },
    error: { label: "Check failed", cls: "border-bad/50 text-bad", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  };
  const s = map[link.status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function LinkRow({ link, canEdit, onChange }: { link: JiraLink; canEdit: boolean; onChange: (next: JiraLink | null, error?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "check" | "unlink">("");
  const hasDetail = Boolean(link.resultSummary || link.findings.length);

  async function recheck() {
    setBusy("check");
    try {
      const { link: next } = await request<{ link: JiraLink }>(`/api/app/jira/links/${link.id}`, { method: "POST" });
      onChange(next);
      setOpen(true);
    } catch (err) {
      onChange(link, (err as Error).message);
    }
    setBusy("");
  }
  async function unlink() {
    setBusy("unlink");
    try {
      await request(`/api/app/jira/links/${link.id}`, { method: "DELETE" });
      onChange(null);
    } catch (err) {
      onChange(link, (err as Error).message);
      setBusy("");
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a href={link.issueUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-steel hover:text-ink">
              {link.issueKey} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <StatusPill link={link} />
          </p>
          <p className="mt-0.5 truncate text-sm text-ink/80">{link.summary}</p>
          <p className="mt-0.5 text-xs text-muted">
            {link.checkedAt ? `${link.auto ? "Re-checked automatically" : `Checked by ${link.checkedBy ?? "someone"}`} ${fmt(link.checkedAt)}` : "Not checked yet"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {hasDetail ? (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1 font-semibold text-steel hover:text-ink">
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /> Details
            </button>
          ) : null}
          {canEdit ? (
            <>
              <button type="button" onClick={recheck} disabled={Boolean(busy)} className="inline-flex items-center gap-1 font-semibold text-steel hover:text-ink disabled:opacity-50">
                {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Check again
              </button>
              <button type="button" onClick={unlink} disabled={Boolean(busy)} className="text-muted hover:text-bad disabled:opacity-50">
                Unlink
              </button>
            </>
          ) : null}
        </div>
      </div>
      {open && hasDetail ? (
        <div className="mt-3 rounded-lg border border-ink/10 bg-surface p-3 text-sm">
          {link.resultSummary ? <p className="leading-relaxed text-ink">{link.resultSummary}</p> : null}
          {link.findings.length ? (
            <ul className="mt-2 space-y-2">
              {link.findings.map((f, i) => (
                <li key={i} className={`border-l-[3px] pl-3 ${f.kind === "departs" ? "border-bad" : "border-warn"}`}>
                  <p className={`text-xs font-semibold ${f.kind === "departs" ? "text-bad" : "text-warn"}`}>
                    {f.requirementId} · {f.kind === "departs" ? "departs from what was agreed" : "not covered by what was agreed"}
                  </p>
                  <p className="leading-relaxed text-ink">{f.detail}</p>
                  {f.excerpt ? <p className="mt-0.5 text-ink/70">&ldquo;{f.excerpt}&rdquo;</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function CreateIssues({ lockId, claimCount, onDone }: { lockId: string; claimCount: number; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ key: string; name: string }[] | null>(null);
  const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setOpen(true);
    setError("");
    if (projects) return;
    try {
      const data = await request<{ projects: { key: string; name: string }[] }>(`/api/app/locks/${lockId}/jira?projects=1`);
      setProjects(data.projects);
      setProject(data.projects[0]?.key ?? "");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await request<{ created: string[]; skipped: number }>(`/api/app/locks/${lockId}/jira`, {
        method: "POST",
        body: JSON.stringify({ action: "create", projectKey: project }),
      });
      onDone(
        r.created.length
          ? `Created ${r.created.length} issue${r.created.length === 1 ? "" : "s"}: ${r.created.join(", ")}.${r.skipped ? ` ${r.skipped} already had one.` : ""}`
          : "Every requirement already has a Jira issue."
      );
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  if (!open)
    return (
      <button type="button" onClick={start} className="inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-ink">
        <Plus className="h-4 w-4" /> Create Jira issues from this record
      </button>
    );
  return (
    <div className="rounded-lg border border-ink/10 bg-surface p-4">
      <p className="text-sm font-semibold">Create Jira issues</p>
      <p className="mt-1 text-sm text-ink/70">
        One issue per requirement ({claimCount}), labelled <code className="font-mono text-xs">knowledge-lock</code> and linked back here.
        Requirements that already have an issue are skipped.
      </p>
      {projects === null && !error ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading projects</p>
      ) : projects?.length ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="jira-project" className="sr-only">Project</label>
          <select id="jira-project" value={project} onChange={(e) => setProject(e.target.value)} className="rounded-lg border border-ink/20 bg-transparent px-3 py-2 text-sm sm:flex-1">
            {projects.map((p) => (
              <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
            ))}
          </select>
          <button type="button" onClick={create} disabled={busy || !project} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create issues
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-steel hover:text-ink">Cancel</button>
        </div>
      ) : projects ? (
        <p className="mt-3 text-sm text-ink/70">The connected Jira account can&apos;t see any projects.</p>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-bad">{error}</p> : null}
    </div>
  );
}

/** Jira on a locked record: check issues against it, create issues from it, and see linked issues. Product only. */
export default function JiraPanel({ lockId, claimCount }: { lockId: string; claimCount: number }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setPanel(await request<Panel>(`/api/app/locks/${lockId}/jira`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [lockId]);
  useEffect(() => {
    let live = true;
    request<Panel>(`/api/app/locks/${lockId}/jira`)
      .then((p) => live && setPanel(p))
      .catch((err) => live && setError((err as Error).message));
    return () => {
      live = false;
    };
  }, [lockId]);

  if (!panel) return error ? <p className="text-sm text-bad">{error}</p> : <p className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading Jira</p>;
  if (!panel.connected)
    return (
      <p className="text-sm text-ink/70">
        Jira isn&apos;t connected. An owner can connect it under{" "}
        <Link href="/app/integrations#jira" className="font-semibold text-steel underline hover:text-ink">Integrations</Link>, then check issues
        against this record from here.
      </p>
    );

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { link } = await request<{ link: JiraLink }>(`/api/app/locks/${lockId}/jira`, { method: "POST", body: JSON.stringify({ action: "check", issueKey: key }) });
      setKey("");
      setMessage(`Checked ${link.issueKey} and posted the result on the issue.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const update = (id: string) => (next: JiraLink | null, err?: string) => {
    setError(err ?? "");
    setPanel((p) =>
      p && p.connected
        ? { ...p, links: next ? p.links.map((l) => (l.id === id ? next : l)) : p.links.filter((l) => l.id !== id) }
        : p
    );
  };

  return (
    <div>
      {!panel.current ? (
        <p className="mb-4 rounded-lg border border-warn/40 px-3 py-2 text-sm text-ink/80">
          This version has been replaced. Linked issues are now checked against the{" "}
          <Link href={`/app/l/${panel.latestLockId}`} className="font-semibold text-steel underline hover:text-ink">current version</Link>.
        </p>
      ) : null}

      {panel.canEdit ? (
        <form onSubmit={check} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="jira-key" className="sr-only">Jira issue key or link</label>
          <input
            id="jira-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Issue key, like CLM-42, or its link"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-accent sm:flex-1"
          />
          <button type="submit" disabled={busy || !key.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {busy ? "Checking" : "Check and link"}
          </button>
        </form>
      ) : null}
      {panel.canEdit ? (
        <p className="mt-1.5 text-xs text-muted">
          We read the issue, check it against this record, and post the findings as a comment.
          {panel.autoCheck ? " Linked issues are re-checked when their summary or description changes." : ""}
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-bad">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-good">{message}</p> : null}

      <h3 className="mt-6 text-sm font-semibold">Linked issues ({panel.links.length})</h3>
      {panel.links.length ? (
        <ul className="mt-1 divide-y divide-ink/10 border-y border-ink/10">
          {panel.links.map((l) => (
            <LinkRow key={l.id} link={l} canEdit={panel.canEdit} onChange={update(l.id)} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink/60">None yet.</p>
      )}

      {panel.canEdit && panel.current ? (
        <div className="mt-5">
          <CreateIssues
            lockId={lockId}
            claimCount={claimCount}
            onDone={(msg) => {
              setMessage(msg);
              setError("");
              void load();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
