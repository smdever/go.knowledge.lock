import { handle, readJson } from "@/lib/demo/http";
import { signOff, viewRecord } from "@/lib/demo/service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson(request);
    return viewRecord(await signOff(id, body));
  });
}
