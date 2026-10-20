import Link from "next/link";
import { FilePenLine, Hammer, Lock, Users } from "lucide-react";
import Shell, { Card } from "@/components/Shell";
import StartButton from "@/components/StartButton";
import { ensurePolicyLock } from "@/lib/demo/service";
import { DRAFT_TITLE, ORG_NAME, POLICY_PAYLOAD, STAKEHOLDERS } from "@/lib/demo/scenario";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: FilePenLine, title: "Propose", text: "Start from a draft set of requirements. Edit them, or add one that quietly breaks policy." },
  { icon: Users, title: "Review", text: "Three AI models from different providers check the draft against locked policy. Three stakeholders sign off." },
  { icon: Lock, title: "Lock", text: "Once the rules are met, the agreed version is hashed, signed and stored. Anyone can verify it." },
  { icon: Hammer, title: "Build from it", text: "An agent answers from the locked record only, a ticket is checked for drift, and changes go back through review." },
];

export default async function Home() {
  const policyLockId = await ensurePolicyLock();
  return (
    <Shell>
      <section className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Interactive demo · about 3 minutes</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Signed-off truth for teams and AI</h1>
        <p className="mt-4 text-base leading-relaxed text-ink/75 sm:text-lg">
          {ORG_NAME} is building an AI assistant to help customers raise complaints. Product, Compliance and Engineering
          need to agree exactly what it will do, without breaking the bank&apos;s locked complaints policy. Walk through
          how Knowledge Lock gets them there.
        </p>
        <div className="mt-7">
          <StartButton />
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Card key={s.title}>
            <s.icon className="h-5 w-5 text-accent" />
            <p className="mt-3 font-mono text-xs font-semibold text-accent">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-1 font-bold">{s.title}</h2>
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
                <span className="text-right text-ink/60">{s.title}</span>
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
    </Shell>
  );
}
