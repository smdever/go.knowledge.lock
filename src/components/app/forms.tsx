"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Loader2 } from "lucide-react";
import type { FormState } from "@/app/app/actions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/app/roles";

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
