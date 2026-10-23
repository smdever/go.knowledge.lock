import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { recordFor, updateRecord, viewFor } from "@/lib/app/records";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  return appHandle(async (user) => {
    const { record, role } = await recordFor(user, (await ctx.params).id, "read");
    return viewFor(record, user, role);
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return appHandle(async (user) => {
    const body = await readJson(request);
    const record = await updateRecord(user, (await ctx.params).id, { requirements: body.requirements, fix: body.fix });
    const { role } = await recordFor(user, record.id, "read");
    return viewFor(record, user, role);
  });
}
