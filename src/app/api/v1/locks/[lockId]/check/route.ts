import { apiHandle, readBody } from "@/lib/app/api";
import { audit } from "@/lib/app/orgs";
import { checkOrgDrift, orgLock } from "@/lib/app/records";

/** Where a check came from, when an app says so. Only an https site address is kept, never page text or who asked. */
function sourceOf(raw: unknown): { source: string; site?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { kind, site } = raw as Record<string, unknown>;
  if (kind !== "confluence") return null;
  try {
    const url = new URL(String(site ?? ""));
    return url.protocol === "https:" ? { source: "confluence", site: url.origin } : { source: "confluence" };
  } catch {
    return { source: "confluence" };
  }
}

/**
 * POST /api/v1/locks/{lockId}/check  { "work": "ticket, user story or spec", "source"?: { "kind": "confluence", "site": "https://…" } }
 * The work is checked and then discarded. The activity log records only that a check ran, for which record and version,
 * where from, and how many findings there were.
 */
export async function POST(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return apiHandle(request, async ({ orgId, name }) => {
    const body = await readBody(request);
    const { lockId } = await ctx.params;
    const result = await checkOrgDrift(orgId, lockId, body.work);
    const lock = await orgLock(orgId, lockId);
    await audit(orgId, null, "api.check", lockId, {
      key: name,
      version: Number(lock?.block.payload.metadata?.version ?? 1),
      findings: result.findings.length,
      ...(sourceOf(body.source) ?? {}),
    });
    return result;
  });
}
