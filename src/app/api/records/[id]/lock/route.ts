import { handle } from "@/lib/demo/http";
import { lockRecord } from "@/lib/demo/service";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => ({ lockId: await lockRecord((await ctx.params).id) }));
}
