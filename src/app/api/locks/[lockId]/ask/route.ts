import { handle, readJson } from "@/lib/demo/http";
import { askAgent, clientIp } from "@/lib/demo/service";

export const maxDuration = 60;

export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return handle(async () => {
    const body = await readJson(request);
    return askAgent((await ctx.params).lockId, body.question, clientIp(request));
  });
}
