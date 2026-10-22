import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/app/AppShell";
import { ProfileForm } from "@/components/app/forms";
import { acceptInviteAction, signOut } from "@/app/app/actions";
import { getUser } from "@/lib/app/auth";
import { getInvite, getProfile } from "@/lib/app/orgs";
import { ROLE_HELP, withArticle } from "@/lib/app/roles";

export const metadata: Metadata = { title: "Accept your invite | Knowledge Lock" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInvite(token);
  if (!invite)
    return (
      <PublicShell>
        <h1 className="text-2xl font-semibold tracking-tight">This invite has expired</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
          It may have been used already, or it&apos;s more than 7 days old. Ask the person who invited you to send a new one.
        </p>
      </PublicShell>
    );

  const user = await getUser();
  const intro = (
    <>
      <p className="text-sm font-semibold text-accent">You&apos;re invited</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Join {invite.orgName} on Knowledge Lock</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
        You&apos;ll join as {withArticle(invite.role)}, so you&apos;ll be able to {ROLE_HELP[invite.role]}.
      </p>
    </>
  );

  if (!user)
    return (
      <PublicShell>
        {intro}
        <Link
          href={`/signin?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(`/invite/${token}`)}`}
          className="mt-6 inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Sign in as {invite.email} to accept
        </Link>
      </PublicShell>
    );

  if (user.email !== invite.email)
    return (
      <PublicShell>
        {intro}
        <p className="mt-6 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-ink">
          You&apos;re signed in as <strong>{user.email}</strong>, but this invite is for <strong>{invite.email}</strong>.
        </p>
        <form action={signOut} className="mt-4">
          <button type="submit" className="text-sm font-semibold text-steel hover:text-ink">Sign out and use {invite.email}</button>
        </form>
      </PublicShell>
    );

  const profile = await getProfile(user.id);
  return (
    <PublicShell>
      {intro}
      <div className="mt-8">
        <ProfileForm action={acceptInviteAction} token={token} name={profile?.name} title={profile?.title} submit={`Join ${invite.orgName}`} />
      </div>
    </PublicShell>
  );
}
