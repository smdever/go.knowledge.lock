import { after } from "next/server";
import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { onRestored, onRetired } from "@/lib/app/jira";
import { restoreLock, retireLock } from "@/lib/app/records";

export const maxDuration = 60;

type Ctx = { params: Promise<{ lockId: string }> };

/** Owners only. POST { reason } retires a locked record; DELETE restores it. */
export async function POST(request: Request, ctx: Ctx) {
  return appHandle(async (user) => {
    const { reason } = await readJson(request);
    const result = await retireLock(user, (await ctx.params).lockId, reason);
    // Tell linked Jira issues once the response has gone.
    after(() => onRetired(result.orgId, result.retirement).catch((err) => console.warn("[knowledge-lock] jira after retire", err)));
    return { retired: result.retirement, draftsArchived: result.draftsArchived };
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  return appHandle(async (user) => {
    const lockId = (await ctx.params).lockId;
    const { orgId, by } = await restoreLock(user, lockId);
    after(() => onRestored(orgId, lockId, by).catch((err) => console.warn("[knowledge-lock] jira after restore", err)));
    return { restored: true };
  });
}
