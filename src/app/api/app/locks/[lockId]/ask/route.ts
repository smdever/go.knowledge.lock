import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { askAgent } from "@/lib/app/records";

export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return appHandle(async (user) => askAgent(user, (await ctx.params).lockId, (await readJson(request)).question));
}
