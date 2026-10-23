import { apiHandle, lockLink } from "@/lib/app/api";
import { orgLock, orgPolicyLockId } from "@/lib/app/records";

/** GET /api/v1/policy — the organisation's current locked policy, or null if there isn't one. */
export async function GET(request: Request) {
  return apiHandle(request, async ({ orgId }) => {
    const id = await orgPolicyLockId(orgId);
    const found = id ? await orgLock(orgId, id) : null;
    if (!found) return { policy: null };
    const b = found.block;
    return {
      policy: {
        lockId: b.lockId,
        title: b.payload.title,
        version: Number(b.payload.metadata?.version ?? 1),
        lockedAt: new Date(b.lockedAt).toISOString(),
        claims: b.payload.claims.map((c) => ({ id: c.id, statement: c.statement })),
        url: lockLink(b.lockId),
      },
    };
  });
}
