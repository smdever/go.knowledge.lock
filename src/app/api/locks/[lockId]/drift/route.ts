import { handle, readJson } from "@/lib/demo/http";
import { checkDrift, clientIp } from "@/lib/demo/service";

export const maxDuration = 60;

export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return handle(async () => {
    const body = await readJson(request);
    return checkDrift((await ctx.params).lockId, body.work, clientIp(request));
  });
}
