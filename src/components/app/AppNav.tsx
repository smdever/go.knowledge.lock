"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { initials } from "@/components/Avatar";

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  label?: string;
  links: NavLink[];
}

export interface AppNavProps {
  /** Always visible in the header on wide screens. */
  primary: NavLink[];
  /** In the account menu on wide screens; grouped in the drawer on small ones. */
  menu: NavGroup[];
  user: { name: string; email: string };
  orgs: { id: string; name: string; current: boolean }[];
  roleLabel?: string;
  signOut: () => Promise<void>;
  switchOrg: (fd: FormData) => Promise<void>;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

function UserBadge({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-steel font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name) || "?"}
    </span>
  );
}

function OrgSwitcher({ orgs, switchOrg }: Pick<AppNavProps, "orgs" | "switchOrg">) {
  if (orgs.length < 2) return null;
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Switch organisation</p>
      {orgs.map((o) => (
        <form key={o.id} action={switchOrg}>
          <input type="hidden" name="orgId" value={o.id} />
          <button
            type="submit"
            disabled={o.current}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/5 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className={`truncate ${o.current ? "font-semibold" : "text-ink/80"}`}>{o.name}</span>
            {o.current ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
          </button>
        </form>
      ))}
    </div>
  );
}

function MenuLinks({ groups, pathname, onPick }: { groups: NavGroup[]; pathname: string; onPick: () => void }) {
  return (
    <>
      {groups
        .filter((g) => g.links.length)
        .map((g, i) => (
          <div key={g.label ?? i} className="border-t border-ink/10 py-1 first:border-t-0">
            {g.label ? (
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
            ) : null}
            {g.links.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={onPick}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm hover:bg-ink/5 ${active ? "font-semibold text-ink" : "text-ink/80"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
    </>
  );
}

function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5 hover:text-ink"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </form>
  );
}

/** Account menu for wide screens. */
/** Open state that resets itself when the page changes: it's only open on the page it was opened on. */
function useOpenOnPage(pathname: string): [boolean, (open: boolean | ((o: boolean) => boolean)) => void] {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenOn(value ? pathname : null);
  };
  return [open, setOpen];
}

function AccountMenu(props: AppNavProps & { pathname: string }) {
  const [open, setOpen] = useOpenOnPage(props.pathname);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="account-menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-ink/80 hover:bg-ink/5 hover:text-ink"
      >
        <UserBadge name={props.user.name} size={28} />
        <span className="max-w-[9rem] truncate">{props.user.name.split(" ")[0]}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="sr-only">Open account menu</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id="account-menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-2xl border border-ink/10 bg-bg p-2 shadow-xl shadow-ink/10"
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <UserBadge name={props.user.name} size={36} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{props.user.name}</p>
                <p className="truncate text-xs text-muted">{props.user.email}</p>
              </div>
            </div>
            <div className="border-t border-ink/10">
              <OrgSwitcher orgs={props.orgs} switchOrg={props.switchOrg} />
            </div>
            <div className="border-t border-ink/10">
              <MenuLinks groups={props.menu} pathname={props.pathname} onPick={() => setOpen(false)} />
            </div>
            <div className="border-t border-ink/10 pt-1">
              <SignOutButton signOut={props.signOut} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Slide-out drawer for phones and tablets. */
function Drawer(props: AppNavProps & { pathname: string }) {
  const [open, setOpen] = useOpenOnPage(props.pathname);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      // Keep keyboard focus inside the drawer while it's open.
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = trigger.current;
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      t?.focus();
    };
  }, [open]);

  const current = props.orgs.find((o) => o.current);
  const groups: NavGroup[] = [{ links: props.primary }, ...props.menu];
  // The header's backdrop blur would trap a fixed drawer inside it, so the drawer renders at the end of <body>.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="app-drawer"
        className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-ink/80 hover:bg-ink/5 hover:text-ink"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </button>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <div className="fixed inset-0 z-50" role="presentation">
                  <motion.div
                    className="absolute inset-0 bg-ink/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setOpen(false)}
                  />
                  <motion.div
                    ref={panel}
                    id="app-drawer"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menu"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-bg shadow-2xl"
                  >
                    <div className="flex h-14 items-center justify-between border-b border-ink/10 px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserBadge name={props.user.name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{props.user.name}</p>
                          <p className="truncate text-xs text-muted">
                            {current ? `${current.name}${props.roleLabel ? ` · ${props.roleLabel}` : ""}` : props.user.email}
                          </p>
                        </div>
                      </div>
                      <button
                        ref={closeBtn}
                        type="button"
                        onClick={() => setOpen(false)}
                        className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink"
                      >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close menu</span>
                      </button>
                    </div>
                    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-2">
                      <MenuLinks groups={groups} pathname={props.pathname} onPick={() => setOpen(false)} />
                      {props.orgs.length > 1 ? (
                        <div className="border-t border-ink/10">
                          <OrgSwitcher orgs={props.orgs} switchOrg={props.switchOrg} />
                        </div>
                      ) : null}
                    </nav>
                    <div className="border-t border-ink/10 p-2">
                      <p className="truncate px-3 pb-1 pt-1 text-xs text-muted">{props.user.email}</p>
                      <SignOutButton signOut={props.signOut} />
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

export default function AppNav(props: AppNavProps) {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <div className="hidden items-center gap-1 lg:flex">
        <nav aria-label="Main" className="mr-2 flex items-center gap-1 text-sm">
          {props.primary.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-ink/5 hover:text-ink ${active ? "font-semibold text-ink" : "text-ink/70"}`}
              >
                {l.label}
                {active ? <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-accent" /> : null}
              </Link>
            );
          })}
        </nav>
        <AccountMenu {...props} pathname={pathname} />
      </div>
      <div className="lg:hidden">
        <Drawer {...props} pathname={pathname} />
      </div>
    </MotionConfig>
  );
}
