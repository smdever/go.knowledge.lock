import { appHandle } from "@/lib/app/http";
import { lockRecord } from "@/lib/app/records";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => ({ lockId: await lockRecord(user, (await ctx.params).id) }));
}
