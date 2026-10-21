import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import LockScreens from "@/components/LockScreens";
import ScrollToTop from "@/components/ScrollToTop";
import { getLockView } from "@/lib/demo/service";
import { SAMPLE_QUESTIONS, SAMPLE_TICKET } from "@/lib/demo/scenario";

export const dynamic = "force-dynamic";

export default async function LockPage({
  params,
  searchParams,
}: {
  params: Promise<{ lockId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { lockId } = await params;
  const { new: isNew } = await searchParams;
  const view = await getLockView(lockId);
  if (!view) notFound();

  return (
    <Shell>
      {isNew ? <ScrollToTop /> : null}
      <LockScreens
        block={view.block}
        verification={view.verification}
        supersededBy={view.supersededBy}
        isPolicy={view.isPolicy}
        policyLockId={view.policyLockId}
        authorityEphemeral={view.authorityEphemeral}
        isNew={Boolean(isNew)}
        questions={SAMPLE_QUESTIONS}
        sampleTicket={SAMPLE_TICKET}
      />
    </Shell>
  );
}
