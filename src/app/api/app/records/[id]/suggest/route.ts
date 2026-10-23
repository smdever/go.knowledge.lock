import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { suggestFix } from "@/lib/app/records";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const body = await readJson(request);
    return suggestFix(user, (await ctx.params).id, { requirementId: body.requirementId, provider: body.provider });
  });
}
