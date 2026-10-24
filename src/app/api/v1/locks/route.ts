import { apiHandle, lockLink } from "@/lib/app/api";
import { listOrgLocks } from "@/lib/app/records";

/** GET /api/v1/locks?include=replaced,retired — the organisation's current locked records. */
export async function GET(request: Request) {
  return apiHandle(request, async ({ orgId }) => {
    const include = (new URL(request.url).searchParams.get("include") ?? "").split(",").map((s) => s.trim());
    const locks = await listOrgLocks(orgId, { replaced: include.includes("replaced"), retired: include.includes("retired") });
    return { locks: locks.map((l) => ({ ...l, url: lockLink(l.lockId) })) };
  });
}
