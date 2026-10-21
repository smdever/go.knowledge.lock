import Link from "next/link";
import { Lock } from "lucide-react";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span>Knowledge Lock</span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">Demo</span>
          </Link>
          <a href={SITE_URL} className="hidden text-sm text-muted hover:text-ink sm:inline">
            by Guided Orchestration
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>Halden Bank and everyone named in this demo are fictional.</span>
          <a href={SITE_URL} className="hover:text-ink">
            Guided Orchestration
          </a>
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
    good: "border-good/40 bg-good/10 text-good",
    warn: "border-warn/40 bg-warn/10 text-warn",
    bad: "border-bad/40 bg-bad/10 text-bad",
    accent: "border-accent/40 bg-accent/10 text-accent",
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
