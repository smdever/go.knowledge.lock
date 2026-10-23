import { apiHandle, readBody } from "@/lib/app/api";
import { checkOrgDrift } from "@/lib/app/records";

/** POST /api/v1/locks/{lockId}/check  { "work": "ticket, user story or spec" } */
export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return apiHandle(request, async ({ orgId }) => {
    const body = await readBody(request);
    return checkOrgDrift(orgId, (await ctx.params).lockId, body.work);
  });
}
