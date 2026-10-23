"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import type { FormState } from "@/app/app/actions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/app/roles";
import { addPasskey } from "@/lib/app/passkey-client";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export const inputClass =
  "w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-accent";

export function Submit({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 ${className}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-ink/15 p-2">
      <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-steel hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function Result({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="mt-3 text-sm font-semibold text-bad">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <div role="status" className="mt-3 text-sm text-good">
        <p className="font-semibold">{state.message}</p>
        {state.link ? <CopyLink link={state.link} /> : null}
      </div>
    );
  return null;
}

export function SignInForm({ action, next, email, dev }: { action: Action; next: string; email?: string; dev: boolean }) {
  const [state, formAction] = useActionState(action, {});
  if (state.sentTo)
    return (
      <div role="status">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
          If <strong>{state.sentTo}</strong> has access to Knowledge Lock, we&apos;ve sent a sign-in link to it. The link
          works once and expires after an hour.
        </p>
        <p className="mt-6 text-sm text-ink/70">
          Nothing arrived and you&apos;re new here?{" "}
          <a href="/request-access" className="font-semibold text-steel underline hover:text-ink">Request access</a>
        </p>
      </div>
    );
  return (
    <form action={formAction}>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-[15px] text-ink/70">We&apos;ll email you a link. There&apos;s no password.</p>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="mt-6 block text-sm font-semibold">Work email</label>
      <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className={`mt-2 ${inputClass}`} />
      <Submit className="mt-4 w-full">Email me a sign-in link</Submit>
      {dev ? <p className="mt-3 text-xs text-warn">Local dev sign-in is on: you&apos;ll be signed in straight away.</p> : null}
      <Result state={state} />
      <p className="mt-8 border-t border-ink/10 pt-6 text-sm text-ink/70">
        New to Knowledge Lock?{" "}
        <a href="/request-access" className="font-semibold text-steel underline hover:text-ink">Request access</a>
      </p>
    </form>
  );
}

export function ProfileForm({
  action,
  token,
  name,
  title,
  submit,
}: {
  action: Action;
  token?: string;
  name?: string;
  title?: string;
  submit: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold">Your name</label>
        <input id="name" name="name" required maxLength={80} defaultValue={name} autoComplete="name" className={`mt-2 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-semibold">Job title</label>
        <input id="title" name="title" maxLength={80} defaultValue={title} autoComplete="organization-title" className={`mt-2 ${inputClass}`} />
        <p className="mt-1 text-xs text-muted">Shown next to your name when you sign something off.</p>
      </div>
      <Submit>{submit}</Submit>
      <Result state={state} />
    </form>
  );
}

export function InviteForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="invite-email" className="sr-only">Email</label>
        <input id="invite-email" name="email" type="email" required placeholder="colleague@company.com" className={`${inputClass} sm:flex-1`} />
        <label htmlFor="invite-role" className="sr-only">Role</label>
        <select id="invite-role" name="role" defaultValue="signer" className={`${inputClass} sm:w-36`}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <Submit>Invite</Submit>
      </div>
      <Result state={state} />
    </form>
  );
}

export function RoleForm({ action, userId, role }: { action: Action; userId: string; role: Role }) {
  const [state, formAction] = useActionState(action, {});
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (state.error && select.current) select.current.value = role; // the change was refused
  }, [state, role]);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Role</label>
      <select
        ref={select}
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-ink/15 bg-transparent px-2 py-1 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      {state.error ? <span role="alert" className="text-xs font-semibold text-bad">{state.error}</span> : null}
    </form>
  );
}

export function RemoveForm({ action, userId, label }: { action: Action; userId: string; label: string }) {
  const [state, formAction] = useActionState(action, {});
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      {confirming ? (
        <>
          <button type="submit" className="text-xs font-semibold text-bad hover:underline">Remove {label}?</button>
          <button type="button" onClick={() => setConfirming(false)} className="text-xs text-muted hover:text-ink">Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-xs text-muted hover:text-bad">Remove</button>
      )}
      {state.error ? <span role="alert" className="text-xs font-semibold text-bad">{state.error}</span> : null}
    </form>
  );
}

export function CreateOrgForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="org-name" className="block text-sm font-semibold">Organisation name</label>
          <input id="org-name" name="name" required maxLength={80} className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="owner-email" className="block text-sm font-semibold">Owner&apos;s work email</label>
          <input id="owner-email" name="ownerEmail" type="email" required className={`mt-2 ${inputClass}`} />
        </div>
      </div>
      <Submit>Create and invite the owner</Submit>
      <Result state={state} />
    </form>
  );
}

export function ApiKeyForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="key-name" className="sr-only">Key name</label>
        <input id="key-name" name="name" required maxLength={60} placeholder="e.g. Delivery agent, Jira sync" className={`${inputClass} sm:flex-1`} />
        <Submit>Create key</Submit>
      </div>
      <Result state={state} />
    </form>
  );
}

/** Adds a passkey on this device: the browser asks for Touch ID, Face ID, Windows Hello, a phone or a security key. */
export function AddPasskeyButton({ first }: { first: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<FormState>({});
  async function add() {
    setBusy(true);
    setState({});
    try {
      await addPasskey();
      setState({ message: "Passkey added. Your sign-offs will now be signed with it." });
      router.refresh();
    } catch (err) {
      setState({ error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {first ? "Set up a passkey" : "Add another passkey"}
      </button>
      <Result state={state} />
    </div>
  );
}

export function RequirePasskeysForm({ action, on }: { action: Action; on: boolean }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction}>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="require" defaultChecked={on} className="mt-1 h-4 w-4 accent-accent" />
        <span>
          <span className="font-semibold">Require a passkey for every sign-off</span>
          <span className="block text-sm text-ink/65">
            Applies to records started after you save. Drafts already under way keep their current rule. Make sure your signers
            have set up a passkey on their Profile page first.
          </span>
        </span>
      </label>
      <Submit className="mt-4">Save</Submit>
      <Result state={state} />
    </form>
  );
}

export function SlackIdForm({ action, value }: { action: Action; value?: string | null }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction}>
      <label htmlFor="slackId" className="block text-sm font-semibold">Slack member ID (optional)</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input id="slackId" name="slackId" maxLength={24} defaultValue={value ?? ""} placeholder="U0123ABCD" className={`${inputClass} font-mono sm:flex-1`} />
        <Submit>Save</Submit>
      </div>
      <p className="mt-1 text-xs text-muted">In Slack, open your profile, then ⋮ › Copy member ID. Lets our Slack notices @mention you.</p>
      <Result state={state} />
    </form>
  );
}

const EVENTS: { id: string; label: string; help: string }[] = [
  { id: "signoff_needed", label: "Sign-off needed", help: "When the AI reviewers approve a draft, mentioning who still has to sign" },
  { id: "changes_requested", label: "Changes requested", help: "When a signer asks for changes, with their comment" },
  { id: "locked", label: "Locked", help: "When a record or the policy is locked" },
];

export function AddChannelForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const [kind, setKind] = useState<"slack" | "teams">("slack");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold">Where</legend>
        <div className="mt-2 flex gap-2">
          {(["slack", "teams"] as const).map((k) => (
            <label key={k} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold ${kind === k ? "border-accent text-ink" : "border-ink/20 text-ink/60"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === "slack" ? "Slack" : "Microsoft Teams"}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="channel-name" className="block text-sm font-semibold">Channel name</label>
        <input id="channel-name" name="name" required maxLength={60} placeholder={kind === "slack" ? "#delivery-signoffs" : "Delivery › Sign-offs"} className={`mt-2 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="channel-url" className="block text-sm font-semibold">Webhook link</label>
        <input id="channel-url" name="url" required type="url" autoComplete="off" spellCheck={false}
          placeholder={kind === "slack" ? "https://hooks.slack.com/services/…" : "https://….powerplatform.com/… or https://….logic.azure.com/…"}
          className={`mt-2 ${inputClass} font-mono text-sm`} />
        <p className="mt-1 text-xs text-muted">
          {kind === "slack"
            ? "In Slack: create an app at api.slack.com/apps, turn on Incoming Webhooks, add one for the channel and copy its link."
            : "In Teams: open the channel's ⋯ menu › Workflows › “Post to a channel when a webhook request is received”, then copy the link it gives you."}{" "}
          Treat the link like a password. We store it encrypted.
        </p>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Post when</legend>
        <div className="mt-2 space-y-2">
          {EVENTS.map((e) => (
            <label key={e.id} className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" name="events" value={e.id} defaultChecked className="mt-1 h-4 w-4 accent-accent" />
              <span>
                {e.label}
                <span className="block text-sm text-ink/60">{e.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Submit>Connect and send a test</Submit>
      <Result state={state} />
    </form>
  );
}

export function TestChannelButton({ action, id }: { action: Action; id: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <TextSubmit>Send a test</TextSubmit>
      {state.message ? <span className="ml-2 text-sm text-good">{state.message}</span> : null}
      {state.error ? <span className="ml-2 text-sm text-bad">{state.error}</span> : null}
    </form>
  );
}

function TextSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-sm font-semibold text-steel hover:text-ink disabled:opacity-50">
      {pending ? "Sending…" : children}
    </button>
  );
}

export function RequestAccessForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  if (state.sentTo)
    return (
      <div role="status">
        <h1 className="text-2xl font-semibold tracking-tight">Thanks, we&apos;ve got your request</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
          We&apos;ll get back to you at <strong>{state.sentTo}</strong>, usually within two working days. If your organisation is
          already on Knowledge Lock, one of its owners can invite you straight away.
        </p>
        <p className="mt-6 text-sm">
          <a href="/signin" className="font-semibold text-steel underline hover:text-ink">Back to sign in</a>
        </p>
      </div>
    );
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request access</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
          Knowledge Lock is open to a small group of design partners. Tell us a little about you and we&apos;ll be in touch. If
          your organisation already uses it, ask one of its owners to invite you instead.
        </p>
      </div>
      <div>
        <label htmlFor="ra-name" className="block text-sm font-semibold">Your name</label>
        <input id="ra-name" name="name" required maxLength={80} autoComplete="name" className={`mt-2 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="ra-email" className="block text-sm font-semibold">Work email</label>
        <input id="ra-email" name="email" type="email" required autoComplete="email" className={`mt-2 ${inputClass}`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ra-company" className="block text-sm font-semibold">Organisation</label>
          <input id="ra-company" name="company" required maxLength={120} autoComplete="organization" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ra-title" className="block text-sm font-semibold">Job title</label>
          <input id="ra-title" name="title" maxLength={80} autoComplete="organization-title" className={`mt-2 ${inputClass}`} />
        </div>
      </div>
      <div>
        <label htmlFor="ra-message" className="block text-sm font-semibold">What would you like to use it for? (optional)</label>
        <textarea id="ra-message" name="message" rows={4} maxLength={1000} className={`mt-2 ${inputClass}`} />
      </div>
      {/* Hidden from people; catches bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="ra-website">Website</label>
        <input id="ra-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Submit className="w-full">Send request</Submit>
      <p className="text-xs text-muted">
        We use these details only to reply to you and set up access. See our{" "}
        <a href={`${process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com"}/privacy`} className="underline hover:text-ink">
          privacy notice
        </a>
        .
      </p>
      <Result state={state} />
      <p className="border-t border-ink/10 pt-6 text-sm text-ink/70">
        Already have access? <a href="/signin" className="font-semibold text-steel underline hover:text-ink">Sign in</a>
      </p>
    </form>
  );
}

export interface AccessRequestView {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  message: string;
  created: string;
}

/** Pending access requests. One result area above the list, so it stays put when an approved request drops off. */
export function AccessRequests({
  requests,
  approve,
  dismiss,
}: {
  requests: AccessRequestView[];
  approve: Action;
  dismiss: (fd: FormData) => Promise<void>;
}) {
  const [state, formAction] = useActionState(approve, {});
  return (
    <div>
      <Result state={state} />
      {requests.length ? (
        <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {requests.map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.name}
                    {r.title ? <span className="font-normal text-ink/70">, {r.title}</span> : null}
                    <span className="font-normal text-ink/70"> at {r.company}</span>
                  </p>
                  <p className="text-sm text-ink/60">
                    <a href={`mailto:${r.email}`} className="hover:text-ink">{r.email}</a> · {r.created}
                  </p>
                  {r.message ? <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-ink/80">&ldquo;{r.message}&rdquo;</p> : null}
                </div>
                <form action={dismiss}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="text-sm text-muted hover:text-bad">Dismiss</button>
                </form>
              </div>
              <form action={formAction} className="mt-3">
                <input type="hidden" name="id" value={r.id} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="sm:flex-1">
                    <label htmlFor={`org-${r.id}`} className="block text-xs font-semibold text-ink/70">Organisation name</label>
                    <input id={`org-${r.id}`} name="orgName" defaultValue={r.company} maxLength={80} className={`mt-1 ${inputClass}`} />
                  </div>
                  <Submit>Create and invite as owner</Submit>
                </div>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink/65">No requests waiting. People can ask for access from the sign-in page.</p>
      )}
    </div>
  );
}
