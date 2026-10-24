import { after } from "next/server";
import { appHandle } from "@/lib/app/http";
import { onNewVersion } from "@/lib/app/jira";
import { lockOrg, lockRecord, orgLock } from "@/lib/app/records";

export const maxDuration = 120;

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return appHandle(async (user) => {
    const lockId = await lockRecord(user, (await ctx.params).id);
    // A new version: move linked Jira issues to it (and re-check them) once the response has gone.
    after(async () => {
      try {
        const orgId = await lockOrg(user, lockId);
        const parent = orgId ? (await orgLock(orgId, lockId))?.block.parentLockId : undefined;
        if (orgId && parent) await onNewVersion(orgId, parent, lockId);
      } catch (err) {
        console.warn("[knowledge-lock] jira after lock", err);
      }
    });
    return { lockId };
  });
}
