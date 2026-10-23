import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { signOffRequest } from "@/lib/app/records";

/** POST { decision, comment }: whether to sign with a passkey, and what the passkey must sign. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const { id } = await ctx.params;
    const body = await readJson(request);
    return signOffRequest(user, id, { decision: body.decision, comment: body.comment });
  });
}
