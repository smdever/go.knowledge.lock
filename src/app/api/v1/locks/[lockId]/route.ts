import { apiHandle } from "@/lib/app/api";
import { lockView } from "@/lib/app/lockview";

/**
 * GET /api/v1/locks/{lockId} — the full signed lock, checked on the server, plus whether it has been replaced or retired.
 * `summary` is a short, display-ready version for apps (such as the Confluence app) that show a record's status.
 * Signers appear by name and title only, never by email, since apps may show them to a wider audience.
 */
export async function GET(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return apiHandle(request, async ({ orgId }) => lockView(orgId, (await ctx.params).lockId));
}
