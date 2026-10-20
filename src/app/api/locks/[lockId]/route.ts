import { handle } from "@/lib/demo/http";
import { DemoError, getLockView } from "@/lib/demo/service";

export async function GET(_request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return handle(async () => {
    const view = await getLockView((await ctx.params).lockId);
    if (!view) throw new DemoError("Locked record not found.", 404);
    return view;
  });
}
