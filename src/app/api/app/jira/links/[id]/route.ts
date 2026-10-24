import { DemoError } from "@/lib/demo/service";
import { appHandle } from "@/lib/app/http";
import { linkOrg, recheckLink, unlinkIssue } from "@/lib/app/jira";

export const maxDuration = 120;

async function orgFor(id: string) {
  const orgId = await linkOrg(id);
  if (!orgId) throw new DemoError("That issue isn't linked any more.", 404);
  return orgId;
}

/** POST: check the linked issue again. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const { id } = await ctx.params;
    return { link: await recheckLink(user, await orgFor(id), id) };
  });
}

/** DELETE: unlink the issue (and remove the web link in Jira). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const { id } = await ctx.params;
    await unlinkIssue(user, await orgFor(id), id);
    return { ok: true };
  });
}
