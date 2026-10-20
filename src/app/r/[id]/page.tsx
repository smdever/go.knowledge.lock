import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import Workspace from "@/components/Workspace";
import { getStore } from "@/lib/demo/store";
import { viewRecord } from "@/lib/demo/service";
import { POLICY_PAYLOAD } from "@/lib/demo/scenario";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getStore().getRecord(id);
  if (!record) notFound();
  const view = await viewRecord(record);
  return (
    <Shell>
      <Workspace initial={view} policy={POLICY_PAYLOAD.claims} policyTitle={POLICY_PAYLOAD.title} />
    </Shell>
  );
}
