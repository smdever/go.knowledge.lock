import { apiHandle, lockLink } from "@/lib/app/api";
import { listOrgLocks } from "@/lib/app/records";

/** GET /api/v1/locks?include=replaced — the organisation's current locked records. */
export async function GET(request: Request) {
  return apiHandle(request, async ({ orgId }) => {
    const includeReplaced = new URL(request.url).searchParams.get("include") === "replaced";
    const locks = await listOrgLocks(orgId, includeReplaced);
    return { locks: locks.map((l) => ({ ...l, url: lockLink(l.lockId) })) };
  });
}
