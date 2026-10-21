import { handle, readJson } from "@/lib/demo/http";
import { clientIp, suggestFix } from "@/lib/demo/service";

export const maxDuration = 60;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await readJson(request);
    return suggestFix((await ctx.params).id, body, clientIp(request));
  });
}
