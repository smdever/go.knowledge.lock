import {
  computeCanonicalPayloadHash,
  createKnowledgeLock,
  evaluateConsensus,
  verifyKnowledgeLock,
  type ConsensusPolicy,
  type KnowledgeClaim,
  type KnowledgeLockBlock,
  type KnowledgePayload,
} from "@/lib/protocol";
import { getAuthorityKey } from "@/lib/demo/authority";
import { callModelJson } from "@/lib/demo/models/call";
import { isConfigured, providerConfigs, stubEnabled } from "@/lib/demo/models/config";
import {
  askSystem,
  askUser,
  driftSystem,
  driftUser,
  fixSystem,
  fixUser,
  forOrganisation,
  reviewSystem,
} from "@/lib/demo/models/prompts";
import { ASK_SCHEMA, DRIFT_SCHEMA, FIX_SCHEMA } from "@/lib/demo/models/schemas";
import {
  chargeUsage,
  DemoError,
  fixHint,
  MAX_QUESTION,
  MAX_STATEMENT,
  MAX_TITLE,
  MAX_WORK_ITEM,
  mergeReviews,
  newId,
  parseStatements,
  pickAgentProvider,
  resolvedBy,
  reviewWith,
  type LockView,
} from "@/lib/demo/service";
import { postgresStore } from "@/lib/demo/store/postgres";
import type { DemoRecord, FixSuggestion, ProviderId, RecordView } from "@/lib/demo/types";
import type { AppUser } from "./auth";
import { appDb } from "./db";
import { noticeEmail, sendEmail } from "./email";
import { appUrl } from "@/lib/mode";
import { AppError, audit, getProfile } from "./orgs";
import type { Role } from "./roles";

export type RecordKind = "requirements" | "policy";

export interface SignerRef {
  userId: string;
  email: string;
  name: string;
  title: string;
}

/** A product record: the demo's record shape, plus who it belongs to and who must sign it. */
export interface AppRecord extends DemoRecord {
  orgId: string;
  kind: RecordKind;
  createdBy: string;
  signers: SignerRef[];
  quorum: number;
  /** Who has been emailed that their sign-off is needed, for which wording. Stops repeat emails. */
  notified?: { hash: string; userIds: string[] };
}

export const MAX_CLAIMS = 30;
const prefixFor = (kind: RecordKind) => (kind === "policy" ? "P" : "R");
const signerKey = (userId: string) => `user:${userId}`;

// ---------- Access ----------

interface Org {
  id: string;
  name: string;
  policyLockId: string | null;
}

async function getOrg(orgId: string): Promise<Org> {
  const db = await appDb();
  const [o] = await db<Org[]>`SELECT id, name, policy_lock_id AS "policyLockId" FROM kl_organisations WHERE id = ${orgId}`;
  if (!o) throw new DemoError("Organisation not found.", 404);
  return o;
}

export async function memberRole(orgId: string, userId: string): Promise<Role | null> {
  const db = await appDb();
  const [m] = await db<{ role: Role }[]>`SELECT role FROM kl_members WHERE org_id = ${orgId} AND user_id = ${userId}`;
  return m?.role ?? null;
}

async function loadRecord(id: string): Promise<AppRecord | null> {
  const db = await appDb();
  const [row] = await db<{ data: AppRecord }[]>`SELECT data FROM kl_app_records WHERE id = ${id}`;
  return row?.data ?? null;
}

async function saveRecord(r: AppRecord): Promise<void> {
  const db = await appDb();
  const data = db.json(r as never);
  await db`
    INSERT INTO kl_app_records (id, org_id, kind, status, created_by, lock_id, data, updated_at)
    VALUES (${r.id}, ${r.orgId}, ${r.kind}, ${r.status}, ${r.createdBy}, ${r.lockId ?? null}, ${data}, now())
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, lock_id = EXCLUDED.lock_id, data = EXCLUDED.data, updated_at = now()`;
}

/** Loads a record and checks the person belongs to its organisation. "edit" also needs owner or signer. */
export async function recordFor(user: AppUser, id: string, need: "read" | "edit"): Promise<{ record: AppRecord; role: Role }> {
  const record = await loadRecord(id);
  const role = record ? await memberRole(record.orgId, user.id) : null;
  if (!record || !role) throw new DemoError("Record not found.", 404);
  if (need === "edit" && role === "viewer") throw new DemoError("Viewers can read records but not change them.", 403);
  return { record, role };
}

function assertDraft(record: AppRecord) {
  if (record.status !== "draft") throw new DemoError("This record is locked. Propose a change to create a new version.", 409);
}

/** A lock that belongs to one of this organisation's records. */
async function orgLock(orgId: string, lockId: string): Promise<{ block: KnowledgeLockBlock; recordId: string } | null> {
  const db = await appDb();
  const [row] = await db<{ block: KnowledgeLockBlock; recordId: string }[]>`
    SELECT l.block, l.record_id AS "recordId" FROM kl_locks l JOIN kl_app_records r ON r.id = l.record_id
    WHERE l.lock_id = ${lockId} AND r.org_id = ${orgId}`;
  return row ?? null;
}

export async function policyClaimsFor(orgId: string, policyLockId: string | null | undefined): Promise<KnowledgeClaim[]> {
  if (!policyLockId) return [];
  const lock = await orgLock(orgId, policyLockId);
  return lock?.block.payload.claims ?? [];
}

// ---------- Emails ----------

const recordUrl = (id: string) => `${appUrl()}/app/r/${id}`;
const lockUrl = (lockId: string) => `${appUrl()}/app/l/${lockId}`;

async function emailOf(userId: string): Promise<string | null> {
  const db = await appDb();
  const [row] = await db<{ email: string }[]>`SELECT email FROM kl_members WHERE user_id = ${userId} LIMIT 1`;
  return row?.email ?? null;
}

/** Sends one email per address, never to the person who caused it. Failures are logged, never thrown. */
async function notify(emails: (string | null)[], exclude: string, mail: ReturnType<typeof noticeEmail>) {
  const to = [...new Set(emails.filter((e): e is string => Boolean(e) && e !== exclude))];
  await Promise.all(
    to.map((addr) =>
      sendEmail(addr, mail.subject, mail.html, mail.text).catch((err) => console.error("[knowledge-lock] notify failed", err))
    )
  );
}

const what = (r: AppRecord) => (r.kind === "policy" ? "the policy" : `"${r.payload.title}"`);

/** Once the AI reviewers pass the current wording, ask the signers who haven't signed it yet. Only once per wording. */
async function askForSignOffs(record: AppRecord, org: Org, actor: AppUser) {
  const policy = consensusPolicy(record);
  const m = evaluateConsensus(record.attestations, policy, record.payloadHash).metrics;
  const modelsPass = m.modelRejections === 0 && m.distinctModelCount >= policy.modelRules.minDistinctModels;
  if (!modelsPass) return;
  const signed = new Set(
    record.attestations.filter((a) => a.attestorType === "human" && a.subjectHash === record.payloadHash).map((a) => a.role)
  );
  const already = record.notified?.hash === record.payloadHash ? record.notified.userIds : [];
  const due = record.signers.filter((s) => !signed.has(signerKey(s.userId)) && !already.includes(s.userId) && s.userId !== actor.id);
  if (!due.length) return;
  record.notified = { hash: record.payloadHash, userIds: [...already, ...due.map((s) => s.userId)] };
  await notify(
    due.map((s) => s.email),
    actor.email,
    noticeEmail({
      orgName: org.name,
      subject: `Your sign-off is needed: ${record.payload.title}`,
      heading: `Your sign-off is needed on ${what(record)}`,
      lines: [
        `The AI reviewers have approved v${record.version} of ${what(record)} in ${org.name}. ${record.quorum} of ${record.signers.length} signers need to approve it before it can be locked.`,
        "Read the exact wording, then sign it off or ask for changes.",
      ],
      cta: "Review and sign off",
      url: recordUrl(record.id),
    })
  );
}

// ---------- Rules ----------

/** Models: at least two providers approve with no objections. People: the quorum approves and nobody objects. */
export function consensusPolicy(record: Pick<AppRecord, "kind" | "quorum" | "signers">): ConsensusPolicy {
  const available = Math.max(1, providerConfigs().filter(isConfigured).length);
  return {
    policyId: `kl-${record.kind}-quorum-v1`,
    name: `${record.quorum} of ${record.signers.length} sign-off`,
    description: `At least ${Math.min(2, available)} AI models from different providers approve with no objections; ${record.quorum} of the ${record.signers.length} named signers approve and none objects.`,
    modelRules: { minDistinctModels: Math.min(2, available), minDistinctProviders: Math.min(2, available), maxModelRejections: 0 },
    humanRules: { required: true, minApprovals: record.quorum, allowVeto: true },
    cryptoRules: { hashAlgorithm: "SHA-256", requireSignedAttestations: false },
  };
}

function buildPayload(record: AppRecord, orgName: string, title: string, claims: KnowledgeClaim[], policyLockId?: string | null): KnowledgePayload {
  return {
    schemaVersion: "1.0.0",
    title,
    domain: `${record.orgId}.${record.kind}`,
    claims,
    tags: [record.kind],
    metadata: {
      organisation: orgName,
      kind: record.kind,
      recordId: record.id,
      version: record.version,
      ...(record.parentLockId ? { parentLockId: record.parentLockId } : {}),
      ...(record.kind === "requirements" && policyLockId ? { policyLockId } : {}),
      // Who was asked to sign, and how many had to agree. Signed with the content.
      signers: record.signers.map((s) => ({ name: s.name, title: s.title, email: s.email })),
      quorum: record.quorum,
      ...(record.resolutions?.length ? { resolutions: record.resolutions } : {}),
    },
  };
}

// ---------- Views ----------

export async function viewFor(record: AppRecord, user: AppUser, role: Role): Promise<RecordView> {
  const org = await getOrg(record.orgId);
  const current = new Set((await eligibleSigners(record.orgId)).map((s) => s.userId));
  return {
    record,
    evaluation: evaluateConsensus(record.attestations, consensusPolicy(record), record.payloadHash),
    stakeholders: [],
    providers: providerConfigs().map((p) => ({ id: p.id, model: p.model, configured: isConfigured(p) })),
    policyLockId: org.policyLockId ?? "",
    signers: record.signers.map((s) => ({
      key: signerKey(s.userId),
      name: s.name,
      // Someone who has left, or become a viewer, can no longer sign.
      title: current.has(s.userId) ? s.title : "No longer a signer in this organisation",
      email: s.email,
      canSign: s.userId === user.id && current.has(s.userId),
    })),
    quorum: record.quorum,
    canEdit: role !== "viewer",
    claimPrefix: prefixFor(record.kind),
    maxClaims: MAX_CLAIMS,
    kind: record.kind,
  };
}

export interface RecordSummary {
  id: string;
  kind: RecordKind;
  title: string;
  status: "draft" | "locked";
  version: number;
  lockId: string | null;
  updatedAt: Date;
  approvals: number;
  quorum: number;
  signerCount: number;
  waitingOnMe: boolean;
  superseded: boolean;
}

export async function listRecords(orgId: string, userId: string): Promise<RecordSummary[]> {
  const db = await appDb();
  const rows = await db<{ data: AppRecord; updatedAt: Date; superseded: boolean }[]>`
    SELECT r.data, r.updated_at AS "updatedAt",
      EXISTS (SELECT 1 FROM kl_supersessions s WHERE s.lock_id = r.lock_id) AS superseded
    FROM kl_app_records r WHERE r.org_id = ${orgId} ORDER BY r.updated_at DESC LIMIT 200`;
  return rows.map(({ data: r, updatedAt, superseded }) => {
    const current = r.attestations.filter((a) => a.attestorType === "human" && a.subjectHash === r.payloadHash);
    const mine = current.find((a) => a.role === signerKey(userId));
    return {
      id: r.id,
      kind: r.kind,
      title: r.payload.title,
      status: r.status,
      version: r.version,
      lockId: r.lockId ?? null,
      updatedAt,
      approvals: current.filter((a) => a.decision === "APPROVE").length,
      quorum: r.quorum,
      signerCount: r.signers.length,
      waitingOnMe: r.status === "draft" && r.signers.some((s) => s.userId === userId) && !mine,
      superseded,
    };
  });
}

/** People who can be asked to sign: owners and signers. */
export async function eligibleSigners(orgId: string): Promise<SignerRef[]> {
  const db = await appDb();
  return db<SignerRef[]>`
    SELECT m.user_id AS "userId", m.email, coalesce(p.name, m.email) AS name, coalesce(p.title, '') AS title
    FROM kl_members m LEFT JOIN kl_profiles p ON p.user_id = m.user_id
    WHERE m.org_id = ${orgId} AND m.role IN ('owner', 'signer') ORDER BY coalesce(p.name, m.email)`;
}

// ---------- Create and edit ----------

export async function createRecord(
  user: AppUser,
  orgId: string,
  input: { kind?: unknown; title?: unknown; statements?: unknown; signerIds?: unknown; quorum?: unknown; parentLockId?: unknown }
): Promise<AppRecord> {
  const role = await memberRole(orgId, user.id);
  if (!role) throw new DemoError("You're not in this organisation.", 403);
  if (role === "viewer") throw new DemoError("Viewers can't create records.", 403);
  const org = await getOrg(orgId);
  const now = Date.now();
  const base = { id: newId(), orgId, createdBy: user.id, status: "draft" as const, createdAt: now, updatedAt: now };
  const empty = { attestations: [], modelReviews: [], resolutions: [], scenarioId: "product" };

  // A new version of a locked record: same kind, signers, quorum and wording to start from.
  if (typeof input.parentLockId === "string" && input.parentLockId) {
    const parent = await orgLock(orgId, input.parentLockId);
    if (!parent) throw new DemoError("Locked record not found.", 404);
    if (await postgresStore.getSupersededBy(input.parentLockId)) throw new DemoError("This record has already been replaced by a newer version.", 409);
    const prev = await loadRecord(parent.recordId);
    if (!prev) throw new DemoError("Locked record not found.", 404);
    if (prev.kind === "policy" && role !== "owner") throw new DemoError("Only owners can change the policy.", 403);
    const current = await eligibleSigners(orgId);
    const signers = prev.signers.filter((s) => current.some((c) => c.userId === s.userId));
    if (!signers.length) throw new DemoError("None of the original signers are still here. Start a new record instead.", 409);
    const record: AppRecord = {
      ...base,
      ...empty,
      kind: prev.kind,
      version: prev.version + 1,
      parentLockId: input.parentLockId,
      signers,
      quorum: Math.min(prev.quorum, signers.length),
      payload: {} as KnowledgePayload,
      payloadHash: "",
    };
    const claims = parent.block.payload.claims.map((c) => ({ id: c.id, statement: c.statement }));
    record.payload = buildPayload(record, org.name, parent.block.payload.title, claims, org.policyLockId);
    record.payloadHash = await computeCanonicalPayloadHash(record.payload);
    await saveRecord(record);
    await audit(orgId, user, "record.created", record.id, { version: record.version, parentLockId: record.parentLockId });
    return record;
  }

  const kind: RecordKind = input.kind === "policy" ? "policy" : "requirements";
  if (kind === "policy" && role !== "owner") throw new DemoError("Only owners can propose the policy.", 403);
  const title = typeof input.title === "string" ? input.title.trim().slice(0, MAX_TITLE) : "";
  if (!title) throw new DemoError("Give the record a title.");
  const statements = parseStatements(input.statements, MAX_CLAIMS, `Keep it to ${MAX_CLAIMS} lines. Split bigger sets into separate records.`);
  const ids = Array.isArray(input.signerIds) ? [...new Set(input.signerIds.map(String))] : [];
  const eligible = await eligibleSigners(orgId);
  const signers = eligible.filter((s) => ids.includes(s.userId));
  if (!signers.length) throw new DemoError("Choose at least one person to sign it off.");
  if (signers.length !== ids.length) throw new DemoError("Signers must be owners or signers in this organisation.");
  const quorum = Number(input.quorum);
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > signers.length) throw new DemoError("Choose how many people must approve.");

  const record: AppRecord = {
    ...base,
    ...empty,
    kind,
    version: 1,
    signers,
    quorum,
    payload: {} as KnowledgePayload,
    payloadHash: "",
  };
  const prefix = prefixFor(kind);
  const claims = statements.map((statement, i) => ({ id: `${prefix}${i + 1}`, statement }));
  record.payload = buildPayload(record, org.name, title, claims, org.policyLockId);
  record.payloadHash = await computeCanonicalPayloadHash(record.payload);
  await saveRecord(record);
  await audit(orgId, user, "record.created", record.id, { kind, version: 1, signers: signers.length, quorum });
  return record;
}

export async function updateRecord(user: AppUser, id: string, input: { requirements?: unknown; fix?: unknown }): Promise<AppRecord> {
  const { record } = await recordFor(user, id, "edit");
  assertDraft(record);
  const org = await getOrg(record.orgId);
  const statements = parseStatements(input.requirements, MAX_CLAIMS, `Keep it to ${MAX_CLAIMS} lines.`);
  const prefix = prefixFor(record.kind);
  const claims = statements.map((statement, i) => ({ id: `${prefix}${i + 1}`, statement }));
  record.resolutions = [...(record.resolutions ?? []), ...resolvedBy(record, statements, fixHint(input.fix))].slice(-10);
  const policyLockId = (record.payload.metadata?.policyLockId as string | undefined) ?? org.policyLockId;
  record.payload = buildPayload(record, org.name, record.payload.title, claims, policyLockId);
  const hash = await computeCanonicalPayloadHash(record.payload);
  if (hash !== record.payloadHash) {
    // New wording: every review and sign-off has to be given again.
    record.payloadHash = hash;
    record.attestations = [];
    record.modelReviews = [];
  }
  record.updatedAt = Date.now();
  await saveRecord(record);
  return record;
}

// ---------- AI review and fixes ----------

async function chargeOrg(orgId: string, calls: number) {
  await chargeUsage(`org:${orgId}`, calls, {
    perHour: Number(process.env.KL_ORG_HOURLY_LIMIT || 300),
    perDay: Number(process.env.KL_DAILY_LIMIT || 3000),
    hourMessage: "Your organisation has reached its hourly limit for AI reviews. Please try again shortly.",
    dayMessage: "Today's AI usage limit has been reached. Please try again tomorrow.",
  });
}

/** Requirements are checked against the policy they were drafted under; policies are checked on their own. */
async function reviewPolicyFor(record: AppRecord): Promise<KnowledgeClaim[]> {
  if (record.kind === "policy") return [];
  return policyClaimsFor(record.orgId, record.payload.metadata?.policyLockId as string | undefined);
}

export async function runReview(user: AppUser, id: string): Promise<AppRecord> {
  const { record } = await recordFor(user, id, "edit");
  assertDraft(record);
  const org = await getOrg(record.orgId);
  const providers = providerConfigs().filter(isConfigured);
  if (providers.length === 0) throw new DemoError("No AI providers are configured on the server.", 503);
  await chargeOrg(record.orgId, providers.length);
  const policy = await reviewPolicyFor(record);
  const system = reviewSystem(forOrganisation(org.name));
  const reviews = await Promise.all(providers.map((p) => reviewWith(p, record, policy, system)));

  const latest = await loadRecord(id);
  if (!latest || latest.payloadHash !== record.payloadHash || latest.status !== "draft") {
    throw new DemoError("The wording changed during review. Run the review again.", 409);
  }
  mergeReviews(latest, reviews);
  latest.updatedAt = Date.now();
  await askForSignOffs(latest, org, user);
  await saveRecord(latest);
  const objections = reviews.filter((r) => r.decision === "REJECT").length;
  await audit(latest.orgId, user, "record.reviewed", latest.id, { version: latest.version, objections });
  return latest;
}

export async function suggestFix(user: AppUser, id: string, input: { requirementId?: unknown; provider?: unknown }): Promise<FixSuggestion> {
  const { record } = await recordFor(user, id, "edit");
  assertDraft(record);
  const org = await getOrg(record.orgId);
  const target = record.payload.claims.find((c) => c.id === input.requirementId);
  if (!target) throw new DemoError("Line not found.");
  const reviews = record.modelReviews.filter((r) => r.status === "ok" && r.subjectHash === record.payloadHash);
  const objecting = reviews.filter((r) => r.issues.some((i) => i.requirementId === target.id));
  if (objecting.length === 0) throw new DemoError("No model raised an issue with this line.");
  const requested = objecting.find((r) => r.provider === input.provider) ?? objecting[0];
  const provider = providerConfigs().filter(isConfigured).find((p) => p.id === requested.provider) ?? pickAgentProvider();
  const issues = (objecting.find((r) => r.provider === provider.id) ?? requested).issues.filter((i) => i.requirementId === target.id);

  await chargeOrg(record.orgId, 1);
  const raw = await callModelJson(provider, {
    task: "fix",
    schema: FIX_SCHEMA,
    system: fixSystem(forOrganisation(org.name)),
    user: fixUser(await reviewPolicyFor(record), record.payload.claims, target, issues),
    maxTokens: 800,
  });
  const statement = String(raw.statement ?? "").trim().slice(0, MAX_STATEMENT);
  if (!statement) throw new DemoError("The model did not propose any wording. Try again.", 502);
  return {
    requirementId: target.id,
    statement,
    explanation: String(raw.explanation ?? "").slice(0, 400),
    provider: provider.id as ProviderId,
    model: provider.model,
    stub: !provider.apiKey,
  };
}

// ---------- Sign-off and lock ----------

export async function signOff(user: AppUser, id: string, input: { decision?: unknown; comment?: unknown }): Promise<AppRecord> {
  const { record } = await recordFor(user, id, "read");
  assertDraft(record);
  const signer = record.signers.find((s) => s.userId === user.id);
  if (!signer) throw new DemoError("You're not one of the signers for this record.", 403);
  if (!(await eligibleSigners(record.orgId)).some((s) => s.userId === user.id)) {
    throw new DemoError("Only owners and signers can sign off. Ask an owner to change your role.", 403);
  }
  if (input.decision !== "APPROVE" && input.decision !== "REJECT") throw new DemoError("Choose approve or request changes.");
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 400) : "";
  if (input.decision === "REJECT" && !comment) throw new DemoError("Say what needs to change.");
  // Their current name and title, in case they've updated their profile since the record was created.
  const profile = await getProfile(user.id);
  const name = profile?.name || signer.name;
  const title = profile?.title ?? signer.title;

  record.attestations = record.attestations.filter((a) => !(a.attestorType === "human" && a.role === signerKey(user.id)));
  record.attestations.push({
    attestationId: `att-user-${newId()}`,
    attestorType: "human",
    attestorId: `${name}${title ? `, ${title}` : ""} (${user.email})`,
    role: signerKey(user.id),
    timestamp: Date.now(),
    decision: input.decision,
    metrics: {},
    reasoning: comment || undefined,
    subjectHash: record.payloadHash,
  });
  record.updatedAt = Date.now();
  await saveRecord(record);
  await audit(record.orgId, user, input.decision === "APPROVE" ? "record.approved" : "record.objected", record.id, {
    version: record.version,
    ...(comment ? { comment } : {}),
  });
  if (input.decision === "REJECT") {
    const org = await getOrg(record.orgId);
    await notify(
      [await emailOf(record.createdBy), ...record.signers.map((s) => s.email)],
      user.email,
      noticeEmail({
        orgName: org.name,
        subject: `Changes requested: ${record.payload.title}`,
        heading: `${name} asked for changes to ${what(record)}`,
        lines: [`"${comment}"`, "Nothing can be locked until they approve or the wording changes."],
        cta: "Open the record",
        url: recordUrl(record.id),
      })
    );
  }
  return record;
}

export async function lockRecord(user: AppUser, id: string): Promise<string> {
  const { record } = await recordFor(user, id, "edit");
  assertDraft(record);
  const policy = consensusPolicy(record);
  const evaluation = evaluateConsensus(record.attestations, policy, record.payloadHash);
  if (!evaluation.passed) throw new DemoError(`Not ready to lock: ${evaluation.failures.join(" ")}`, 409);
  if (record.parentLockId && (await postgresStore.getSupersededBy(record.parentLockId))) {
    throw new DemoError("The previous version has already been replaced by another change.", 409);
  }
  const key = await getAuthorityKey();
  const block = await createKnowledgeLock({
    payload: record.payload,
    attestations: record.attestations,
    policy,
    parentLockId: record.parentLockId,
    authorityPrivateKey: key.privateKey,
    authorityPublicKey: key.publicKey,
  });
  await postgresStore.insertLock(block, record.id);
  if (record.parentLockId) await postgresStore.insertSupersession(record.parentLockId, block.lockId);
  if (record.kind === "policy") {
    const db = await appDb();
    await db`UPDATE kl_organisations SET policy_lock_id = ${block.lockId} WHERE id = ${record.orgId}`;
  }
  record.status = "locked";
  record.lockId = block.lockId;
  record.updatedAt = Date.now();
  await saveRecord(record);
  await audit(record.orgId, user, "record.locked", record.id, { lockId: block.lockId, kind: record.kind, version: record.version });
  const org = await getOrg(record.orgId);
  await notify(
    [await emailOf(record.createdBy), ...record.signers.map((s) => s.email)],
    user.email,
    noticeEmail({
      orgName: org.name,
      subject: `Locked: ${record.payload.title}`,
      heading: `${what(record).replace(/^the/, "The")} is locked`,
      lines: [
        `v${record.version} of ${what(record)} is now the signed-off version in ${org.name}. Teams and AI agents work from exactly this wording.`,
        record.kind === "policy" ? "From now on, new records are checked against it." : "Any change becomes a new version and goes back through review.",
      ],
      cta: "See the locked record",
      url: lockUrl(block.lockId),
    })
  );
  return block.lockId;
}

// ---------- Locks ----------

export async function lockView(user: AppUser, orgId: string, lockId: string): Promise<(LockView & { kind: RecordKind; record: AppRecord }) | null> {
  const lock = await orgLock(orgId, lockId);
  if (!lock || !(await memberRole(orgId, user.id))) return null;
  const record = await loadRecord(lock.recordId);
  if (!record) return null;
  const org = await getOrg(orgId);
  const key = await getAuthorityKey();
  return {
    block: lock.block,
    verification: await verifyKnowledgeLock(lock.block),
    supersededBy: await postgresStore.getSupersededBy(lockId),
    isPolicy: record.kind === "policy",
    policyLockId: org.policyLockId ?? "",
    authorityEphemeral: key.ephemeral,
    modelsLive: !stubEnabled(),
    kind: record.kind,
    record,
  };
}

/** Finds which of the person's organisations a lock belongs to. */
export async function lockOrg(user: AppUser, lockId: string): Promise<string | null> {
  const db = await appDb();
  const [row] = await db<{ orgId: string }[]>`
    SELECT r.org_id AS "orgId" FROM kl_locks l JOIN kl_app_records r ON r.id = l.record_id
    JOIN kl_members m ON m.org_id = r.org_id AND m.user_id = ${user.id}
    WHERE l.lock_id = ${lockId}`;
  return row?.orgId ?? null;
}

async function usableLock(user: AppUser, lockId: string) {
  const orgId = await lockOrg(user, lockId);
  if (!orgId) throw new DemoError("Locked record not found.", 404);
  const lock = await orgLock(orgId, lockId);
  if (!lock) throw new DemoError("Locked record not found.", 404);
  const check = await verifyKnowledgeLock(lock.block);
  if (!check.valid) throw new DemoError("This record failed verification, so the agent will not use it.", 409);
  const org = await getOrg(orgId);
  const policy = await policyClaimsFor(orgId, lock.block.payload.metadata?.policyLockId as string | undefined);
  return { orgId, org, block: lock.block, policy };
}

export async function askAgent(user: AppUser, lockId: string, question: unknown) {
  const q = typeof question === "string" ? question.trim().slice(0, MAX_QUESTION) : "";
  if (!q) throw new DemoError("Ask a question.");
  const { orgId, org, block, policy } = await usableLock(user, lockId);
  const provider = pickAgentProvider();
  await chargeOrg(orgId, 1);
  const raw = await callModelJson(provider, {
    task: "ask",
    schema: ASK_SCHEMA,
    system: askSystem(forOrganisation(org.name)),
    user: askUser(policy, block.payload.claims, block.lockId, q),
    maxTokens: 1000,
  });
  const known = new Set([...block.payload.claims, ...policy].map((c) => c.id));
  return {
    answer: String(raw.answer ?? "").slice(0, 1200),
    citations: (Array.isArray(raw.citations) ? raw.citations : []).map(String).filter((c) => known.has(c)),
    covered: raw.covered !== false,
    model: provider.model,
    provider: provider.id,
    stub: !provider.apiKey,
  };
}

export async function checkDrift(user: AppUser, lockId: string, work: unknown) {
  const text = typeof work === "string" ? work.trim().slice(0, MAX_WORK_ITEM) : "";
  if (!text) throw new DemoError("Paste a ticket or spec to check.");
  const { orgId, org, block, policy } = await usableLock(user, lockId);
  const provider = pickAgentProvider();
  await chargeOrg(orgId, 1);
  const raw = await callModelJson(provider, {
    task: "drift",
    schema: DRIFT_SCHEMA,
    system: driftSystem(forOrganisation(org.name)),
    user: driftUser(policy, block.payload.claims, text),
    maxTokens: 2000,
  });
  const findings = (Array.isArray(raw.findings) ? raw.findings : [])
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
      requirementId: String(f.requirementId ?? "none").slice(0, 12),
      kind: f.kind === "not_covered" ? ("not_covered" as const) : ("departs" as const),
      excerpt: String(f.excerpt ?? "").slice(0, 400),
      detail: String(f.detail ?? "").slice(0, 600),
    }))
    .slice(0, 12);
  return { summary: String(raw.summary ?? "").slice(0, 400), findings, model: provider.model, provider: provider.id, stub: !provider.apiKey };
}

export { AppError };
