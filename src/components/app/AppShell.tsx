import Link from "next/link";
import { Lock, LogOut } from "lucide-react";
import { signOut, switchOrg } from "@/app/app/actions";
import type { AppContext } from "@/lib/app/context";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
        <Lock className="h-3.5 w-3.5" />
      </span>
      <span className={compact ? "hidden md:inline" : ""}>Knowledge Lock</span>
    </span>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
        <span>Knowledge Lock by Guided Orchestration Ltd</span>
        <span className="flex gap-4">
          <a href={`${SITE_URL}/privacy`} className="hover:text-ink">Privacy</a>
          <a href={`${SITE_URL}/terms`} className="hover:text-ink">Terms</a>
        </span>
      </div>
    </footer>
  );
}

/** Frame for pages outside the signed-in app: sign-in and invites. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
          <Brand />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-20">{children}</main>
      <LegalFooter />
    </div>
  );
}

export default function AppShell({ ctx, children }: { ctx: AppContext; children: React.ReactNode }) {
  const nav = [
    { href: "/app", label: "Home" },
    ...(ctx.current
      ? [
          { href: "/app/policies", label: "Policy" },
          { href: "/app/team", label: "Team" },
        ]
      : []),
    { href: "/app/profile", label: "Profile" },
    ...(ctx.admin ? [{ href: "/app/admin", label: "Admin" }] : []),
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/app" aria-label="Knowledge Lock home">
              <Brand compact />
            </Link>
            {ctx.memberships.length > 1 ? (
              <form action={switchOrg} className="hidden sm:block">
                <label htmlFor="org-switch" className="sr-only">Organisation</label>
                <select
                  id="org-switch"
                  name="orgId"
                  defaultValue={ctx.current?.orgId}
                  className="max-w-[14rem] truncate rounded-lg border border-ink/15 bg-transparent px-2 py-1 text-sm"
                >
                  {ctx.memberships.map((m) => (
                    <option key={m.orgId} value={m.orgId}>{m.orgName}</option>
                  ))}
                </select>
                <button type="submit" className="ml-1 text-xs font-semibold text-steel hover:text-ink">Switch</button>
              </form>
            ) : ctx.current ? (
              <span className="hidden truncate text-sm text-muted sm:inline">{ctx.current.orgName}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex items-center gap-3 sm:gap-4">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink/70 hover:text-ink">{n.label}</Link>
              ))}
            </nav>
            <form action={signOut}>
              <button type="submit" className="inline-flex items-center gap-1 text-ink/60 hover:text-ink" title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <LegalFooter />
    </div>
  );
}
