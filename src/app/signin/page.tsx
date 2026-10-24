import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/app/AppShell";
import { SignInForm } from "@/components/app/forms";
import { requestSignInLink } from "@/app/app/actions";
import { devAuthEnabled, getUser, safeNext } from "@/lib/app/auth";

export const metadata: Metadata = { title: "Sign in | Knowledge Lock" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  return (
    <PublicShell>
      {sp.deleted ? (
        <p role="status" className="mb-6 rounded-lg border border-good/50 bg-surface px-3 py-2.5 text-sm text-ink/80">
          Your account has been deleted. We&apos;ve emailed you a confirmation.
        </p>
      ) : null}
      {sp.error === "link" ? (
        <p role="alert" className="mb-6 rounded-lg border border-bad/30 bg-surface px-3 py-2.5 text-sm text-bad">
          That sign-in link has expired or was already used. Request a new one below.
        </p>
      ) : null}
      <SignInForm action={requestSignInLink} next={next} email={sp.email} dev={devAuthEnabled()} />
    </PublicShell>
  );
}
