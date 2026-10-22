import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/Shell";
import { getContext } from "@/lib/app/context";
import { listInvites, listMembers } from "@/lib/app/orgs";
import { ROLE_HELP, withArticle } from "@/lib/app/roles";

export default async function AppHome() {
  const ctx = await getContext();
  const first = ctx.profile?.name?.split(" ")[0];

  if (!ctx.current)
    return (
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{first ? `Welcome, ${first}` : "Welcome"}</h1>
        {ctx.admin ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
              You&apos;re not in an organisation yet. Set up your first design partner and invite its owner.
            </p>
            <Link href="/app/admin" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
              Set up an organisation <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
            You&apos;re signed in as {ctx.user.email}, but you&apos;re not in an organisation yet. Ask the person who invited
            you to send a new invite.
          </p>
        )}
      </section>
    );

  const org = ctx.current;
  const [members, invites] = await Promise.all([listMembers(org.orgId), listInvites(org.orgId)]);
  const owner = org.role === "owner";

  return (
    <div>
      <p className="text-sm font-semibold text-accent">{org.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{first ? `Welcome, ${first}` : "Welcome"}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/75">
        You&apos;re {withArticle(org.role)} here, so you can {ROLE_HELP[org.role]}.
      </p>
      {!ctx.profile ? (
        <p className="mt-4 text-sm">
          <Link href="/app/profile" className="font-semibold text-accent hover:underline">Add your name and job title</Link>{" "}
          <span className="text-ink/65">so colleagues know who signed what.</span>
        </p>
      ) : null}

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Card>
          <FileText className="h-5 w-5 text-accent" />
          <h2 className="mt-3 font-semibold">Records</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            Proposing, reviewing, signing off and locking records arrives in the next update.
          </p>
        </Card>
        <Card>
          <Users className="h-5 w-5 text-accent" />
          <h2 className="mt-3 font-semibold">Your team</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            {members.length} {members.length === 1 ? "person" : "people"}
            {invites.length ? `, ${invites.length} invite${invites.length === 1 ? "" : "s"} pending` : ""}.
          </p>
          <Link href="/app/team" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-steel hover:text-ink">
            {owner ? "Invite and manage people" : "See who's here"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
        <Card>
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h2 className="mt-3 font-semibold">Policies</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            The policies AI models check records against. Owners will be able to add them in the next update.
          </p>
        </Card>
      </div>
    </div>
  );
}
