import { notFound } from "next/navigation";
import LockScreens from "@/components/LockScreens";
import ScrollToTop from "@/components/ScrollToTop";
import { ProductMode } from "@/components/KLContext";
import { getContext } from "@/lib/app/context";
import { lockOrg, lockView, memberRole } from "@/lib/app/records";

export default async function ProductLockPage({
  params,
  searchParams,
}: {
  params: Promise<{ lockId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { lockId } = await params;
  const { new: isNew } = await searchParams;
  const { user } = await getContext(`/app/l/${lockId}`);
  const orgId = await lockOrg(user, lockId);
  const view = orgId ? await lockView(user, orgId, lockId) : null;
  if (!orgId || !view) notFound();
  const role = await memberRole(orgId, user.id);
  const canPropose = view.isPolicy ? role === "owner" : role === "owner" || role === "signer";

  return (
    <ProductMode>
      {isNew ? <ScrollToTop /> : null}
      <LockScreens
        block={view.block}
        verification={view.verification}
        supersededBy={view.supersededBy}
        isPolicy={view.isPolicy}
        policyLockId={view.isPolicy ? "" : (view.block.payload.metadata?.policyLockId as string) || ""}
        authorityEphemeral={view.authorityEphemeral}
        isNew={Boolean(isNew)}
        questions={[]}
        sampleTicket=""
        canPropose={canPropose}
        retired={view.retired}
        canRetire={role === "owner"}
      />
    </ProductMode>
  );
}
