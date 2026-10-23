import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { checkDrift } from "@/lib/app/records";

export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return appHandle(async (user) => checkDrift(user, (await ctx.params).lockId, (await readJson(request)).work));
}
