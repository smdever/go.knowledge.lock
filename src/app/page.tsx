import Link from "next/link";
import { FilePenLine, Hammer, Lock, Users } from "lucide-react";
import Shell, { APP_URL, Card } from "@/components/Shell";
import StartButton from "@/components/StartButton";
import { ensurePolicyLock } from "@/lib/demo/service";
import { DRAFT_TITLE, ORG_NAME, POLICY_PAYLOAD, STAKEHOLDERS } from "@/lib/demo/scenario";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: FilePenLine, title: "Propose", text: "Start from a draft set of requirements. One of them quietly breaks the bank's policy." },
  { icon: Users, title: "Review", text: "Three AI models from different providers check the draft against locked policy. Three stakeholders sign off." },
  { icon: Lock, title: "Lock", text: "Once the rules are met, the agreed version is hashed, signed and stored. Anyone can verify it." },
  { icon: Hammer, title: "Build from it", text: "An agent answers from the locked record only, a ticket is checked for drift, and changes go back through review." },
];

export default async function Home() {
  const policyLockId = await ensurePolicyLock();
  return (
    <Shell>
      <section className="max-w-3xl">
        <p className="text-sm font-semibold text-accent">Interactive demo, about three minutes</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Signed-off truth for teams and AI</h1>
        <p className="mt-4 text-base leading-relaxed text-ink/75 sm:text-lg">
          {ORG_NAME} is building an AI assistant to help customers raise complaints. Product, Compliance and Engineering
          need to agree exactly what it will do, without breaking the bank&apos;s locked complaints policy. Walk through
          how Knowledge Lock gets them there.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <StartButton />
          <span className="text-sm text-ink/70">No sign-up. Everything here is fictional.</span>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Card key={s.title}>
            <s.icon className="h-5 w-5 text-accent" />
            <h2 className="mt-3 font-bold">
              {i + 1}. {s.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{s.text}</p>
          </Card>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">The draft</h2>
          <p className="mt-1 text-sm text-ink/70">{DRAFT_TITLE}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {STAKEHOLDERS.map((s) => (
              <li key={s.role} className="flex justify-between gap-3">
                <span className="font-medium">{s.name}</span>
                <span className="text-right text-ink/70">{s.title}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-bold">Already locked</h2>
          <p className="mt-1 text-sm text-ink/70">{POLICY_PAYLOAD.title}</p>
          <p className="mt-4 text-sm text-ink/70">
            {POLICY_PAYLOAD.claims.length} policy statements the new requirements must respect.
          </p>
          <Link href={`/l/${policyLockId}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
            View the locked policy
          </Link>
        </Card>
      </section>

      <section className="mt-12 flex flex-col gap-5 rounded-2xl border border-accent/35 bg-accent/[0.06] p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">The demo and the app</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Want to use it with your own team?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/75">
            This demo uses a fictional bank and lets you act for everyone. The Knowledge Lock app at app.knowledge-lock.com is for
            real organisations: each person signs in and signs off for themselves, with an optional passkey, Slack and Teams
            notices, and an API for your own AI agents. It&apos;s open to a small group of design partners.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a href={`${APP_URL}/request-access`} className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            Request access
          </a>
          <a href={`${APP_URL}/signin`} className="text-sm font-semibold text-steel hover:text-ink">
            Sign in to the app
          </a>
        </div>
      </section>
    </Shell>
  );
}
