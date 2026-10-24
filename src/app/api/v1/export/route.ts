import { verifyKnowledgeLock } from "@/lib/protocol";
import { apiHandle } from "@/lib/app/api";
import { orgLock, listOrgLocks, orgName } from "@/lib/app/records";

/** GET /api/v1/export — every lock the organisation has, including replaced and retired versions, as signed blocks. */
export async function GET(request: Request) {
  return apiHandle(
    request,
    async ({ orgId }) => {
      const summaries = await listOrgLocks(orgId, { replaced: true, retired: true });
      const locks = [];
      for (const s of summaries) {
        const found = await orgLock(orgId, s.lockId);
        if (!found) continue;
        locks.push({ lock: found.block, supersededBy: s.supersededBy, retired: s.retired, verified: (await verifyKnowledgeLock(found.block)).valid });
      }
      return { organisation: await orgName(orgId), exportedAt: new Date().toISOString(), count: locks.length, locks };
    },
    { audit: "api.export" }
  );
}
