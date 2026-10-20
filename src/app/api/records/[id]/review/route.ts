import { handle } from "@/lib/demo/http";
import { clientIp, runReview, viewRecord } from "@/lib/demo/service";

export const maxDuration = 60;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => viewRecord(await runReview((await ctx.params).id, clientIp(request))));
}
