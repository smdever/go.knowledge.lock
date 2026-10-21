import { handle, readJson } from "@/lib/demo/http";
import { getRecordOrThrow, updateRecord, viewRecord } from "@/lib/demo/service";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => viewRecord(await getRecordOrThrow((await ctx.params).id)));
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson(request);
    return viewRecord(await updateRecord(id, { title: body.title, requirements: body.requirements, fix: body.fix }));
  });
}
