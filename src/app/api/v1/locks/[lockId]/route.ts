import { verifyKnowledgeLock } from "@/lib/protocol";
import { postgresStore } from "@/lib/demo/store/postgres";
import { DemoError } from "@/lib/demo/service";
import { apiHandle, lockLink } from "@/lib/app/api";
import { orgLock, retiredFor } from "@/lib/app/records";

/** GET /api/v1/locks/{lockId} — the full signed lock, checked on the server, plus whether it has been replaced or retired. */
export async function GET(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return apiHandle(request, async ({ orgId }) => {
    const { lockId } = await ctx.params;
    const found = await orgLock(orgId, lockId);
    if (!found) throw new DemoError("Locked record not found.", 404);
    const verification = await verifyKnowledgeLock(found.block);
    const retired = await retiredFor(lockId);
    return {
      lock: found.block,
      verification,
      supersededBy: await postgresStore.getSupersededBy(lockId),
      // Retiring covers every version of the record, so this is set on older versions too.
      retired: retired
        ? { lockId: retired.lockId, retiredAt: new Date(retired.at).toISOString(), retiredBy: retired.by, reason: retired.reason }
        : null,
      url: lockLink(lockId),
    };
  });
}
