import { appHandle } from "@/lib/app/http";
import { runReview, recordFor, viewFor } from "@/lib/app/records";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const { id } = await ctx.params;
    const record = await runReview(user, id);
    const { role } = await recordFor(user, id, "read");
    return viewFor(record, user, role);
  });
}
