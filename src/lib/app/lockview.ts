import { verifyKnowledgeLock } from "@/lib/protocol";
import type { KnowledgeLockBlock } from "@/lib/protocol/types";
import { postgresStore } from "@/lib/demo/store/postgres";
import { DemoError } from "@/lib/demo/service";
import { lockLink } from "./api";
import { newestVersion, orgLock, retiredFor } from "./records";

const versionOf = (block: KnowledgeLockBlock) => Number(block.payload.metadata?.version ?? 1);
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * One locked record as apps and agents see it: the signed lock, whether it verifies, has been replaced or
 * retired, and a display-ready summary. Signers appear by name and title only, never by email.
 * Used by GET /api/v1/locks/{lockId} and the MCP server.
 */
export async function lockView(orgId: string, lockId: string) {
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
}
