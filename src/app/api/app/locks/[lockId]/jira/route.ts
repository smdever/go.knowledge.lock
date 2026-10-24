import { readJson } from "@/lib/demo/http";
import { DemoError } from "@/lib/demo/service";
import { appHandle } from "@/lib/app/http";
import { checkIssue, createIssues, jiraPanel, listProjects } from "@/lib/app/jira";
import { lockOrg } from "@/lib/app/records";

export const maxDuration = 120;

async function orgFor(user: Parameters<typeof lockOrg>[0], lockId: string) {
  const orgId = await lockOrg(user, lockId);
  if (!orgId) throw new DemoError("Locked record not found.", 404);
  return orgId;
}

/** GET: the Jira panel for a locked record (add ?projects=1 for the project list). */
export async function GET(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return appHandle(async (user) => {
    const { lockId } = await ctx.params;
    const orgId = await orgFor(user, lockId);
    if (new URL(request.url).searchParams.get("projects")) return { projects: await listProjects(user, orgId) };
    return jiraPanel(user, orgId, lockId);
  });
}

/** POST { action: "check", issueKey } or { action: "create", projectKey } */
export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return appHandle(async (user) => {
    const { lockId } = await ctx.params;
    const orgId = await orgFor(user, lockId);
    const body = await readJson(request);
    if (body.action === "create") return createIssues(user, orgId, lockId, body.projectKey);
    return { link: await checkIssue(user, orgId, lockId, body.issueKey) };
  });
}
