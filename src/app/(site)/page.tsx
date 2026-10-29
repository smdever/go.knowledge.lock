import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Braces, ClipboardCheck, KanbanSquare, Lock, MessagesSquare, ScrollText, ShieldCheck, UserCheck, Workflow } from "lucide-react";
import ProductShots from "@/components/site/ProductShots";
import {
  CHECKS,
  DESCRIPTION,
  FAQS,
  GO_URL,
  INTEGRATIONS,
  REQUEST_ACCESS_URL,
  SIGN_IN_URL,
  SITE_URL,
  TALK_TO_US_URL,
  TITLE,
  USE_CASES,
} from "@/components/site/content";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: "Knowledge Lock", title: TITLE, description: DESCRIPTION, locale: "en_GB" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Knowledge Lock", url: `${SITE_URL}/`, inLanguage: "en-GB" },
    {
      "@type": "SoftwareApplication",
      name: "Knowledge Lock",
      url: `${SITE_URL}/`,
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      publisher: { "@type": "Organization", name: "Guided Orchestration", url: GO_URL },
    },
  ],
};

const CHECK_ICONS = [Lock, BadgeCheck, UserCheck];
const USE_CASE_ICONS = [ClipboardCheck, ScrollText, ShieldCheck, Workflow];
const INTEGRATION_ICONS = [KanbanSquare, MessagesSquare, Braces];

const primary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-[0_4px_18px_rgba(184,68,42,0.25)] transition-colors hover:bg-accent-hover";
const secondary =
  "inline-flex items-center gap-2 rounded-lg border border-ink/25 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-accent hover:text-accent";

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow?: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="border-t border-ink/10 py-16 sm:py-24">
      <div className="max-w-2xl">
        {eyebrow ? <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p> : null}
        <h2 id={`${id}-title`} className="mt-2 text-2xl font-bold tracking-tight [text-wrap:balance] sm:text-4xl">
          {title}
        </h2>
        {intro ? <p className="mt-4 text-base leading-relaxed text-ink/80 sm:text-lg">{intro}</p> : null}
      </div>
      {children ? <div className="mt-10 sm:mt-12">{children}</div> : null}
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <a href="#main" className="sr-only rounded-lg bg-surface px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="whitespace-nowrap">Knowledge Lock</span>
          </Link>
          <nav aria-label="Main" className="flex shrink-0 items-center gap-5 text-sm">
            <a href="#how-it-works" className="hidden text-ink/75 hover:text-ink md:inline">
              How it works
            </a>
            <a href="#integrations" className="hidden text-ink/75 hover:text-ink md:inline">
              Integrations
            </a>
            <a href="#questions" className="hidden text-ink/75 hover:text-ink md:inline">
              Questions
            </a>
            <a href={SIGN_IN_URL} className="hidden whitespace-nowrap text-ink/75 hover:text-ink sm:inline">
              Sign in
            </a>
            <a
              href={REQUEST_ACCESS_URL}
              className="whitespace-nowrap rounded-lg border border-accent/60 px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent/10 sm:text-sm"
            >
              Request access
            </a>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* 1. First screen */}
        <section aria-labelledby="hero-title" className="py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-accent">
              Knowledge Lock, by{" "}
              <a href={GO_URL} className="underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                Guided Orchestration
              </a>
            </p>
            <h1 id="hero-title" className="mt-4 text-4xl font-bold tracking-tight [text-wrap:balance] sm:text-6xl">
              Signed-off truth for teams and AI
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink/85 sm:text-xl">
              Business units, stakeholders and AI models agree on what&apos;s true. Knowledge Lock locks it, so every team and every AI agent builds from
              the same signed-off version.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              For organisations where requirements, policies and decisions are shared across teams, and where you need to show what was agreed and by whom.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={REQUEST_ACCESS_URL} className={primary}>
                Request access <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link href="/demo" className={secondary}>
                Try the demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">The demo takes about three minutes. No sign-up.</p>
          </div>
        </section>

        {/* 2. Why it matters */}
        <Section
          id="why"
          title="Agreements fall behind when AI moves fast"
          intro="AI helps teams draft, build and decide faster than ever. The agreements behind that work, such as the requirements, the policy or the decision, still live in documents anyone can edit and approvals that only record a click. When versions quietly drift apart, teams and AI agents end up building from different truths."
        />

        {/* 3. How it works */}
        <Section id="how-it-works" eyebrow="How it works" title="From a first draft to a record your teams and agents build from" intro="The examples show a fictional bank.">
          <ProductShots />
        </Section>

        {/* 4. What you can check */}
        <Section id="checks" title="Built to be checked, not trusted">
          <ul className="grid gap-4 md:grid-cols-3">
            {CHECKS.map((c, i) => {
              const Icon = CHECK_ICONS[i];
              return (
                <li key={c.title} className="rounded-2xl border border-ink/15 bg-surface p-6">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h3 className="mt-3 font-bold">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/80 sm:text-base">{c.text}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* 5. Where teams use it */}
        <Section id="use-cases" title="Where teams use it">
          <ul className="grid gap-4 md:grid-cols-2">
            {USE_CASES.map((u, i) => {
              const Icon = USE_CASE_ICONS[i];
              return (
                <li key={u.title} className="flex gap-4 rounded-2xl border border-ink/15 p-6">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <h3 className="font-bold">{u.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/80 sm:text-base">{u.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* 6. Integrations */}
        <Section id="integrations" eyebrow="Integrations" title="Works where your teams already work">
          <ul className="grid gap-4 md:grid-cols-3">
            {INTEGRATIONS.map((x, i) => {
              const Icon = INTEGRATION_ICONS[i];
              return (
              <li key={x.title} className="rounded-2xl border border-ink/15 p-6">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-bold">{x.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/80 sm:text-base">{x.text}</p>
              </li>
              );
            })}
          </ul>
        </Section>

        {/* 7. Early access */}
        <section id="early-access" aria-labelledby="early-access-title" className="border-t border-ink/10 py-16 sm:py-24">
          <div className="rounded-3xl border border-accent/40 bg-surface p-6 sm:p-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Early access</p>
            <h2 id="early-access-title" className="mt-2 max-w-2xl text-2xl font-bold tracking-tight [text-wrap:balance] sm:text-4xl">
              Open to a small group of design partners
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/80 sm:text-lg">
              We&apos;re working with a small number of organisations on a hosted pilot, shaped around a real piece of their work. Partners get direct
              input into what we build next.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={REQUEST_ACCESS_URL} className={primary}>
                Request access <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href={TALK_TO_US_URL} className={secondary}>
                Talk to us <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* 8. Questions */}
        <Section id="questions" eyebrow="Questions" title="Common questions">
          <div className="max-w-3xl divide-y divide-ink/10 border-y border-ink/10">
            {FAQS.map((f) => (
              <details key={f.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{f.question}</span>
                  <span aria-hidden="true" className="text-xl leading-none text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-base leading-relaxed text-ink/80">{f.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      </main>

      {/* 9. Footer */}
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:gap-8 sm:px-6">
          <span>
            Knowledge Lock is made by{" "}
            <a href={GO_URL} className="underline underline-offset-4 hover:text-ink">
              Guided Orchestration
            </a>
            .
          </span>
          <nav aria-label="Footer" className="flex shrink-0 gap-5">
            <a href={`${GO_URL}/privacy`} className="hover:text-ink">
              Privacy
            </a>
            <a href={`${GO_URL}/terms`} className="hover:text-ink">
              Terms
            </a>
            <a href={GO_URL} className="hover:text-ink">
              Guided Orchestration
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
