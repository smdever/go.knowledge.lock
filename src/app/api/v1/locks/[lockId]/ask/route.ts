import { apiHandle, readBody } from "@/lib/app/api";
import { askOrgAgent } from "@/lib/app/records";

/** POST /api/v1/locks/{lockId}/ask  { "question": "…" } */
export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return apiHandle(request, async ({ orgId }) => {
    const body = await readBody(request);
    return askOrgAgent(orgId, (await ctx.params).lockId, body.question);
  });
}
