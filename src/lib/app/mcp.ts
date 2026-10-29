import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DemoError } from "@/lib/demo/service";
import { lockLink, type ApiCaller } from "./api";
import { lockView } from "./lockview";
import { audit, closingDate, longDate } from "./orgs";
import { askOrgAgent, checkOrgDrift, listOrgLocks, orgLock, orgPolicyLockId } from "./records";

/**
 * Knowledge Lock's MCP server: read and check only (R8). Every tool works for the organisation the API key
 * belongs to, refuses a closing organisation (R9), and says which record and version an answer came from (R10).
 */

const INSTRUCTIONS = `Knowledge Lock holds an organisation's signed-off records: requirements, policies and decisions that people and several AI models reviewed, then locked so they can't change. Treat a locked record as the agreed source of truth.

- Use list_locked_records to find the record that applies to your task, then get_locked_record to read it.
- Use ask_locked_record when you need an answer that must come only from what was agreed.
- Use check_work_against_record before finishing a ticket, spec, pull request description or draft, to see where it departs from what was agreed.
- If a record has a newer version, use the newer one unless you were told otherwise.
These tools only read and check. Changes to a record go through review in Knowledge Lock.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const lockIdSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/).describe("The record's lock ID, as given by list_locked_records (0x followed by 64 hex characters).");

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };
const ok = (data: Record<string, unknown>): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data });
const refuse = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

/** Runs a tool, turning Knowledge Lock's errors into plain-words refusals the agent can read. */
async function run(caller: ApiCaller, fn: () => Promise<ToolResult>): Promise<ToolResult> {
  const closing = await closingDate(caller.orgId);
  if (closing) {
    return refuse(`${closing.name} is closing on Knowledge Lock, so its records can't be used. Everything will be deleted on ${longDate(closing.deleteAfter)}.`);
  }
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DemoError) return refuse(err.message);
    console.error("[knowledge-lock] mcp", err);
    return refuse("Something went wrong in Knowledge Lock. Please try again.");
  }
}

async function recordRef(orgId: string, lockId: string) {
  const found = await orgLock(orgId, lockId);
  return found ? { lockId, title: found.block.payload.title, version: Number(found.block.payload.metadata?.version ?? 1), url: lockLink(lockId) } : { lockId };
}

export function knowledgeLockMcp(caller: ApiCaller): McpServer {
  const server = new McpServer({ name: "knowledge-lock", title: "Knowledge Lock", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_locked_records",
    {
      title: "List locked records",
      description:
        "Lists the organisation's locked records that are in use: their lock ID, title, version, when they were locked and how many statements they have. Retired records and replaced versions aren't listed. The policy is separate (get_policy).",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () =>
      run(caller, async () => {
        const locks = (await listOrgLocks(caller.orgId)).filter((l) => l.kind !== "policy");
        return ok({
          records: locks.map((l) => ({ lockId: l.lockId, title: l.title, version: l.version, lockedAt: l.lockedAt, statements: l.claims.length, url: lockLink(l.lockId) })),
        });
      })
  );

  server.registerTool(
    "get_locked_record",
    {
      title: "Read a locked record",
      description:
        "Reads one locked record in full: its numbered statements, version, who signed it off and when, whether it still verifies, whether a newer version exists, and whether it has been retired.",
      inputSchema: { lockId: lockIdSchema },
      annotations: READ_ONLY,
    },
    ({ lockId }) =>
      run(caller, async () => {
        const v = await lockView(caller.orgId, lockId);
        return ok({
          lockId,
          title: v.summary.title,
          version: v.summary.version,
          lockedAt: v.summary.lockedAt,
          verifies: v.summary.valid,
          signedOffBy: v.summary.signedOffBy.map((s) => ({ name: s.name, at: s.at, withPasskey: s.passkey })),
          statements: v.lock.payload.claims.map((c) => ({ id: c.id, statement: c.statement })),
          newerVersion: v.summary.newest,
          retired: v.retired ? { retiredAt: v.retired.retiredAt, retiredBy: v.retired.retiredBy, reason: v.retired.reason } : null,
          url: v.url,
          ...(v.retired ? { note: "This record has been retired. It's no longer the signed-off version, so don't build from it." } : v.summary.newest ? { note: `A newer version (v${v.summary.newest.version}) exists. Use it unless you were told to use this one.` } : {}),
        });
      })
  );

  server.registerTool(
    "get_policy",
    {
      title: "Read the policy",
      description: "Reads the organisation's locked policy: the rules every record is checked against during review.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () =>
      run(caller, async () => {
        const id = await orgPolicyLockId(caller.orgId);
        const found = id ? await orgLock(caller.orgId, id) : null;
        if (!found) return ok({ policy: null, note: "This organisation hasn't locked a policy yet." });
        const b = found.block;
        return ok({
          policy: {
            lockId: b.lockId,
            title: b.payload.title,
            version: Number(b.payload.metadata?.version ?? 1),
            lockedAt: new Date(b.lockedAt).toISOString(),
            statements: b.payload.claims.map((c) => ({ id: c.id, statement: c.statement })),
            url: lockLink(b.lockId),
          },
        });
      })
  );

  server.registerTool(
    "ask_locked_record",
    {
      title: "Ask a locked record",
      description:
        "Answers a question using only one locked record and the policy it was checked against. Says which statements the answer rests on, and says so when the record doesn't cover the question.",
      inputSchema: { lockId: lockIdSchema, question: z.string().min(1).max(1000).describe("The question, in plain words.") },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    ({ lockId, question }) =>
      run(caller, async () => {
        const result = await askOrgAgent(caller.orgId, lockId, question);
        const record = await recordRef(caller.orgId, lockId);
        await audit(caller.orgId, null, "api.ask", lockId, { key: caller.name, version: record.version ?? 1, source: "mcp", covered: result.covered });
        return ok({ record, answer: result.answer, basedOn: result.citations, coveredByRecord: result.covered });
      })
  );

  server.registerTool(
    "check_work_against_record",
    {
      title: "Check work against a locked record",
      description:
        "Checks a piece of work, such as a ticket, spec, pull request description or draft, against one locked record. Returns findings, each naming the statement the work departs from, or saying the work covers something the record doesn't. The text checked isn't kept.",
      inputSchema: {
        lockId: lockIdSchema,
        work: z.string().min(1).max(20000).describe("The work to check. Up to 4,000 characters are checked; longer text is cut."),
      },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    ({ lockId, work }) =>
      run(caller, async () => {
        const result = await checkOrgDrift(caller.orgId, lockId, work);
        const record = await recordRef(caller.orgId, lockId);
        await audit(caller.orgId, null, "api.check", lockId, { key: caller.name, version: record.version ?? 1, findings: result.findings.length, source: "mcp" });
        return ok({
          record,
          summary: result.summary,
          findings: result.findings.map((f) => ({ statement: f.requirementId === "none" ? null : f.requirementId, kind: f.kind, excerpt: f.excerpt, detail: f.detail })),
          ...(work.trim().length > 4000 ? { note: "Only the first 4,000 characters were checked." } : {}),
        });
      })
  );

  return server;
}
