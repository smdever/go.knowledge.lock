import Link from "next/link";
import { Lock } from "lucide-react";
import { signOut, switchOrg } from "@/app/app/actions";
import type { AppContext } from "@/lib/app/context";
import { ROLE_LABEL } from "@/lib/app/roles";
import AppNav, { type NavGroup, type NavLink } from "./AppNav";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-on-accent">
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
  const owner = ctx.current?.role === "owner";
  const primary: NavLink[] = [
    { href: "/app", label: "Home" },
    ...(ctx.current
      ? [
          { href: "/app/policies", label: "Policy" },
          { href: "/app/team", label: "Team" },
          ...(owner ? [{ href: "/app/activity", label: "Activity" }] : []),
        ]
      : []),
  ];
  const menu: NavGroup[] = [
    {
      label: "Organisation settings",
      links: owner
        ? [
            { href: "/app/integrations", label: "Integrations" },
            { href: "/app/api-keys", label: "API keys" },
          ]
        : [],
    },
    {
      label: "You",
      links: [
        { href: "/app/profile", label: "Profile and passkeys" },
        { href: "/app/guide", label: "Guide" },
      ],
    },
    { label: "Guided Orchestration", links: ctx.admin ? [{ href: "/app/admin", label: "Admin" }] : [] },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/app" aria-label="Knowledge Lock home" className="shrink-0">
              <Brand />
            </Link>
            {ctx.current ? (
              <span className="hidden min-w-0 items-center gap-3 text-sm text-muted sm:flex">
                <span aria-hidden="true" className="h-4 w-px bg-ink/15" />
                <span className="truncate">{ctx.current.orgName}</span>
              </span>
            ) : null}
          </div>
          <AppNav
            primary={primary}
            menu={menu}
            user={{ name: ctx.profile?.name || ctx.user.email, email: ctx.user.email }}
            orgs={ctx.memberships.map((m) => ({ id: m.orgId, name: m.orgName, current: m.orgId === ctx.current?.orgId }))}
            roleLabel={ctx.current ? ROLE_LABEL[ctx.current.role] : undefined}
            signOut={signOut}
            switchOrg={switchOrg}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <LegalFooter />
    </div>
  );
}
