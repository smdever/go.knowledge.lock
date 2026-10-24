import Link from "next/link";
import { Lock } from "lucide-react";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";
/** The real product, for design partners. The demo links to it but never shares its data. */
export const APP_URL = (process.env.NEXT_PUBLIC_KL_APP_URL || "https://app.knowledge-lock.com").replace(/\/$/, "");

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span className="whitespace-nowrap">Knowledge Lock</span>
            <span className="rounded-full bg-accent/[0.06] px-2 py-0.5 text-xs font-semibold text-accent">Demo</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-4 text-sm">
            <a href={SITE_URL} className="hidden text-muted hover:text-ink md:inline">
              by Guided Orchestration
            </a>
            <a href={`${APP_URL}/signin`} className="hidden whitespace-nowrap text-ink/70 hover:text-ink sm:inline">
              Sign in
            </a>
            <a
              href={`${APP_URL}/request-access`}
              className="whitespace-nowrap rounded-lg border border-accent/50 px-2.5 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent/10 sm:px-3 sm:text-sm"
            >
              Request access
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:gap-8 sm:px-6">
          <span>
            Halden Bank and everyone named in this demo are fictional. Please don&apos;t enter personal or confidential
            information.
          </span>
          <span className="flex shrink-0 gap-4">
            <a href={`${SITE_URL}/privacy`} className="hover:text-ink">
              Privacy
            </a>
            <a href={`${SITE_URL}/terms`} className="hover:text-ink">
              Terms
            </a>
            <a href={SITE_URL} className="hover:text-ink">
              Guided Orchestration
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function Card({
  children,
  className = "",
  tour,
}: {
  children: React.ReactNode;
  className?: string;
  tour?: string;
}) {
  return (
    <div data-tour={tour} className={`rounded-2xl border border-ink/10 bg-bg/60 p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const tones = {
    neutral: "border-ink/15 text-ink/70",
    good: "border-good/50 text-good",
    warn: "border-warn/50 text-warn",
    bad: "border-bad/50 text-bad",
    accent: "border-accent/50 text-accent",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
