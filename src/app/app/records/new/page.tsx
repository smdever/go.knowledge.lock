import Link from "next/link";
import { redirect } from "next/navigation";
import NewRecordForm from "@/components/app/NewRecordForm";
import { getContext } from "@/lib/app/context";
import { eligibleSigners, MAX_CLAIMS } from "@/lib/app/records";

export default async function NewRecordPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const kind = k === "policy" ? "policy" : "requirements";
  const ctx = await getContext("/app/records/new");
  if (!ctx.current) redirect("/app");
  const role = ctx.current.role;
  if (role === "viewer" || (kind === "policy" && role !== "owner")) redirect("/app");
  const candidates = await eligibleSigners(ctx.current.orgId);

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-accent">{ctx.current.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{kind === "policy" ? "Propose the policy" : "New record"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        {kind === "policy"
          ? "The policy is the set of rules every other record is checked against. Once it's locked, changes go through review and sign-off like anything else."
          : "Write what needs agreeing, choose who signs it off, then send it for AI review."}{" "}
        <Link href="/app" className="text-steel underline hover:text-ink">Cancel</Link>
      </p>
      <div className="mt-8">
        <NewRecordForm kind={kind} candidates={candidates} meId={ctx.user.id} maxClaims={MAX_CLAIMS} />
      </div>
    </div>
  );
}
