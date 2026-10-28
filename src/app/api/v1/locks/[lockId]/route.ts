import { verifyKnowledgeLock } from "@/lib/protocol";
import type { KnowledgeLockBlock } from "@/lib/protocol/types";
import { postgresStore } from "@/lib/demo/store/postgres";
import { DemoError } from "@/lib/demo/service";
import { apiHandle, lockLink } from "@/lib/app/api";
import { newestVersion, orgLock, retiredFor } from "@/lib/app/records";

const versionOf = (block: KnowledgeLockBlock) => Number(block.payload.metadata?.version ?? 1);
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * GET /api/v1/locks/{lockId} — the full signed lock, checked on the server, plus whether it has been replaced or retired.
 * `summary` is a short, display-ready version for apps (such as the Confluence app) that show a record's status.
 * Signers appear by name and title only, never by email, since apps may show them to a wider audience.
 */
export async function GET(request: Request, ctx: { params: Promise<{ lockId: string }> }) {
  return apiHandle(request, async ({ orgId }) => {
    const { lockId } = await ctx.params;
    const found = await orgLock(orgId, lockId);
    if (!found) throw new DemoError("Locked record not found.", 404);
    const verification = await verifyKnowledgeLock(found.block);
    const retired = await retiredFor(lockId);
    const newestId = await newestVersion(lockId);
    const newest = newestId === lockId ? found : await orgLock(orgId, newestId);
    const block = found.block;
    return {
      lock: block,
      verification,
      supersededBy: await postgresStore.getSupersededBy(lockId),
      // Retiring covers every version of the record, so this is set on older versions too.
      retired: retired ? { lockId: retired.lockId, retiredAt: iso(retired.at), retiredBy: retired.by, reason: retired.reason } : null,
      url: lockLink(lockId),
      summary: {
        title: block.payload.title,
        version: versionOf(block),
        lockedAt: iso(block.lockedAt),
        valid: verification.valid,
        signedOffBy: block.consensus.attestations
          .filter((a) => a.attestorType === "human" && a.decision === "APPROVE")
          .map((a) => ({ name: a.attestorId.replace(/\s*\([^()]*@[^()]*\)\s*$/, ""), at: iso(a.timestamp), passkey: Boolean(a.personalSignature) })),
        newest: newest && newestId !== lockId ? { lockId: newestId, version: versionOf(newest.block), url: lockLink(newestId) } : null,
      },
    };
  });
}
