import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { signOff, recordFor, viewFor } from "@/lib/app/records";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const { id } = await ctx.params;
    const body = await readJson(request);
    const record = await signOff(user, id, { decision: body.decision, comment: body.comment });
    const { role } = await recordFor(user, id, "read");
    return viewFor(record, user, role);
  });
}
