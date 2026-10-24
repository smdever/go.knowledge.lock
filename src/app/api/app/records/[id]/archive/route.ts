import { appHandle } from "@/lib/app/http";
import { archiveDraft, restoreDraft } from "@/lib/app/records";

type Ctx = { params: Promise<{ id: string }> };

/** POST archives a draft; DELETE restores it. Its creator or an owner. */
export async function POST(_request: Request, ctx: Ctx) {
  return appHandle(async (user) => {
    const record = await archiveDraft(user, (await ctx.params).id);
    return { archived: Boolean(record.archived) };
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  return appHandle(async (user) => {
    const record = await restoreDraft(user, (await ctx.params).id);
    return { archived: Boolean(record.archived) };
  });
}
