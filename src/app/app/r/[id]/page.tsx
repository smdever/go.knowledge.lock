import { notFound } from "next/navigation";
import Workspace from "@/components/Workspace";
import { ProductMode } from "@/components/KLContext";
import { getContext } from "@/lib/app/context";
import { DemoError } from "@/lib/demo/service";
import { policyClaimsFor, recordFor, viewFor } from "@/lib/app/records";

export default async function ProductRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getContext(`/app/r/${id}`);
  let found;
  try {
    found = await recordFor(user, id, "read");
  } catch (err) {
    if (err instanceof DemoError && err.status === 404) notFound();
    throw err;
  }
  const { record, role } = found;
  const view = await viewFor(record, user, role);
  const policy = record.kind === "policy" ? [] : await policyClaimsFor(record.orgId, record.payload.metadata?.policyLockId as string);
  return (
    <ProductMode>
      <Workspace initial={view} policy={policy} />
    </ProductMode>
  );
}
