import { createHmac } from "node:crypto";
import {
  computeCanonicalPayloadHash,
  createKnowledgeLock,
  evaluateConsensus,
  verifyKnowledgeLock,
  type Attestation,
  type KnowledgeClaim,
  type KnowledgeLockBlock,
  type KnowledgePayload,
  type VerificationResult,
} from "@/lib/protocol";
import { getAuthorityKey } from "./authority";
import { callModelJson } from "./models/call";
import { ASK_SCHEMA, DRIFT_SCHEMA, FIX_SCHEMA, REVIEW_SCHEMA } from "./models/schemas";
import { isConfigured, providerConfigs, stubEnabled, type ProviderConfig } from "./models/config";
import { ASK_SYSTEM, DRIFT_SYSTEM, FIX_SYSTEM, REVIEW_SYSTEM, askUser, driftUser, fixUser, reviewUser } from "./models/prompts";
import {
  DRAFT_REQUIREMENTS,
  DRAFT_TITLE,
  ORG_NAME,
  POLICY_PAYLOAD,
  POLICY_SIGNERS,
  REQUIREMENTS_POLICY,
  SCENARIO_ID,
  SEED_POLICY,
  STAKEHOLDERS,
} from "./scenario";
import { getStore } from "./store";
import type {
  DemoRecord,
  FixSuggestion,
  IssueSeverity,
  IssueType,
  ModelReview,
  ProviderId,
  RecordView,
  Resolution,
  ReviewIssue,
  Role,
} from "./types";

export class DemoError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const MAX_REQUIREMENTS = 12;
export const MAX_STATEMENT = 600;
export const MAX_TITLE = 120;
export const MAX_QUESTION = 400;
export const MAX_WORK_ITEM = 4000;

export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

// ---------- Rate limiting (model calls) ----------

/**
 * IP addresses are never stored as-is: the usage key holds a keyed hash that changes every day,
 * and usage rows are deleted after 48 hours (see the privacy notice).
 */
const ipKey = (ip: string, day: string) =>
  createHmac("sha256", process.env.KL_IP_SALT || "kl-demo-ip-salt").update(`${day}:${ip}`).digest("base64url").slice(0, 22);

export async function chargeModelCalls(ip: string, calls: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await chargeUsage(`ip:${ipKey(ip, day)}`, calls, {
    perHour: Number(process.env.KL_IP_HOURLY_LIMIT || 40),
    perDay: Number(process.env.KL_DAILY_LIMIT || 800),
    hourMessage: "You've hit the demo's hourly limit. Please try again later.",
    dayMessage: "The demo has reached today's usage limit. Please try again tomorrow.",
  });
}

/** Hourly cap per key (an IP hash in the demo, an organisation in the product) plus a daily cap overall. */
export async function chargeUsage(
  key: string,
  calls: number,
  limits: { perHour: number; perDay: number; hourMessage: string; dayMessage: string; dayKey?: string }
): Promise<void> {
  const store = getStore();
  const hour = new Date().toISOString().slice(0, 13);
  const day = hour.slice(0, 10);
  const keyCount = await store.incrementUsage(`${key}:${hour}`, calls);
  if (keyCount > limits.perHour) throw new DemoError(limits.hourMessage, 429);
  const dayCount = await store.incrementUsage(`${limits.dayKey ?? "day"}:${day}`, calls);
  if (dayCount > limits.perDay) throw new DemoError(limits.dayMessage, 429);
}

// ---------- Seeded policy lock ----------

const g = globalThis as unknown as { __klPolicyLock?: Promise<string> };

/** Locks the demo's complaints policy once (idempotent) and returns its lock id. */
export function ensurePolicyLock(): Promise<string> {
  if (!g.__klPolicyLock) {
    g.__klPolicyLock = (async () => {
      const store = getStore();
      const hash = await computeCanonicalPayloadHash(POLICY_PAYLOAD);
      if (await store.getLock(hash)) return hash;
      const attestations: Attestation[] = POLICY_SIGNERS.map((s) => ({
        attestationId: `att-seed-${s.role}`,
        attestorType: "human",
        attestorId: `${s.name} (${s.title})`,
        role: s.role,
        timestamp: Date.now(),
        decision: "APPROVE",
        metrics: {},
        reasoning: "Seeded sign-off for the demo policy.",
        subjectHash: hash,
      }));
      const key = await getAuthorityKey();
      const block = await createKnowledgeLock({
        payload: POLICY_PAYLOAD,
        attestations,
        policy: SEED_POLICY,
        authorityPrivateKey: key.privateKey,
        authorityPublicKey: key.publicKey,
      });
      try {
        await store.insertLock(block, null);
      } catch (err) {
        if (!(await store.getLock(hash))) throw err; // lost a race to another instance: fine
      }
      return hash;
    })().catch((err) => {
      g.__klPolicyLock = undefined;
      throw err;
    });
  }
  return g.__klPolicyLock;
}

// ---------- Records ----------

function buildPayload(
  record: Pick<DemoRecord, "id" | "version" | "parentLockId">,
  title: string,
  claims: KnowledgeClaim[],
  policyLockId: string,
  resolutions: Resolution[] = []
): KnowledgePayload {
  return {
    schemaVersion: "1.0.0",
    title,
    domain: "halden.requirements.complaints-assistant",
    claims,
    tags: ["requirements"],
    metadata: {
      organisation: ORG_NAME,
      recordId: record.id,
      version: record.version,
      ...(record.parentLockId ? { parentLockId: record.parentLockId } : {}),
      policyLockId,
      // How model objections were resolved on the way to this version. Signed along with the content.
      ...(resolutions.length ? { resolutions } : {}),
    },
  };
}

export async function getRecordOrThrow(id: string): Promise<DemoRecord> {
  const record = await getStore().getRecord(id);
  if (!record) throw new DemoError("Record not found.", 404);
  return record;
}

export async function viewRecord(record: DemoRecord): Promise<RecordView> {
  const policyLockId = await ensurePolicyLock();
  return {
    record,
    evaluation: evaluateConsensus(record.attestations, REQUIREMENTS_POLICY, record.payloadHash),
    stakeholders: STAKEHOLDERS,
    providers: providerConfigs().map((p) => ({ id: p.id, model: p.model, configured: isConfigured(p) })),
    policyLockId,
  };
}

export async function createRecord(parentLockId?: string): Promise<DemoRecord> {
  const store = getStore();
  const policyLockId = await ensurePolicyLock();
  let title = DRAFT_TITLE;
  let claims: KnowledgeClaim[] = DRAFT_REQUIREMENTS.map((r) => ({ ...r }));
  let version = 1;

  if (parentLockId) {
    const parent = await store.getLock(parentLockId);
    if (!parent || parent.lockId === policyLockId) throw new DemoError("Locked record not found.", 404);
    const newer = await store.getSupersededBy(parentLockId);
    if (newer) throw new DemoError("This record has already been replaced by a newer version.", 409);
    title = parent.payload.title;
    claims = parent.payload.claims.map((c) => ({ id: c.id, statement: c.statement }));
    version = Number(parent.payload.metadata?.version ?? 1) + 1;
  }

  const now = Date.now();
  const base = { id: newId(), version, parentLockId };
  const payload = buildPayload(base, title, claims, policyLockId);
  const record: DemoRecord = {
    ...base,
    scenarioId: SCENARIO_ID,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    payload,
    payloadHash: await computeCanonicalPayloadHash(payload),
    attestations: [],
    modelReviews: [],
    resolutions: [],
  };
  await store.saveRecord(record);
  return record;
}

/**
 * Works out which current objections an edit resolved. A blocker raised against a requirement whose
 * wording is gone from the new draft counts as reworded (something new at the same position) or removed.
 */
export function resolvedBy(
  record: Pick<DemoRecord, "modelReviews" | "payloadHash" | "payload">,
  next: string[],
  hint?: { requirementId: string; provider: ProviderId }
): Resolution[] {
  const current = record.modelReviews.filter((r) => r.status === "ok" && r.subjectHash === record.payloadHash);
  const oldClaims = record.payload.claims;
  const out: Resolution[] = [];
  for (const [index, claim] of oldClaims.entries()) {
    const raised = current.flatMap((r) =>
      r.issues
        .filter((i) => i.requirementId === claim.id && i.severity === "blocker")
        .map((i) => ({ provider: r.provider, type: i.type, detail: i.detail, policyRef: i.policyRef }))
    );
    if (raised.length === 0 || next.includes(claim.statement)) continue;
    const replacement = next[index];
    const reworded = replacement !== undefined && !oldClaims.some((c) => c.statement === replacement);
    out.push({
      at: Date.now(),
      requirementId: claim.id,
      originalStatement: claim.statement,
      raisedBy: [...new Set(raised.map((r) => r.provider))],
      issues: raised.map((r) => ({ ...r, detail: r.detail.slice(0, 300) })),
      outcome: reworded ? "reworded" : "removed",
      ...(reworded ? { newStatement: replacement } : {}),
      ...(reworded && hint?.requirementId === claim.id ? { suggestedBy: hint.provider } : {}),
    });
  }
  return out;
}

/** Cleans the edited list of statements; empty lines are dropped. */
export function parseStatements(raw: unknown, max: number, tooMany: string): string[] {
  if (!Array.isArray(raw)) throw new DemoError("Requirements are missing.");
  const statements = raw
    .map((r) => (typeof r === "string" ? r : typeof r?.statement === "string" ? r.statement : ""))
    .map((s: string) => s.trim().slice(0, MAX_STATEMENT))
    .filter(Boolean);
  if (statements.length === 0) throw new DemoError("Add at least one requirement.");
  if (statements.length > max) throw new DemoError(tooMany);
  return statements;
}

/** Which model's suggestion an edit came from, when the person accepted a suggested fix. */
export function fixHint(raw: unknown): { requirementId: string; provider: ProviderId } | undefined {
  const fix = raw as { requirementId?: unknown; provider?: unknown } | undefined;
  return fix && typeof fix.requirementId === "string" && ["anthropic", "openai", "google"].includes(String(fix.provider))
    ? { requirementId: fix.requirementId, provider: fix.provider as ProviderId }
    : undefined;
}

function assertDraft(record: DemoRecord) {
  if (record.status !== "draft") throw new DemoError("This record is locked. Propose a change to create a new version.", 409);
}

/** Replaces the requirements. Reviews and sign-offs given for the old content no longer apply. */
export async function updateRecord(
  id: string,
  input: { title?: unknown; requirements?: unknown; fix?: unknown }
): Promise<DemoRecord> {
  const record = await getRecordOrThrow(id);
  assertDraft(record);

  const title = typeof input.title === "string" ? input.title.trim().slice(0, MAX_TITLE) : record.payload.title;
  if (!title) throw new DemoError("Give the record a title.");
  const statements = parseStatements(input.requirements, MAX_REQUIREMENTS, `Keep it to ${MAX_REQUIREMENTS} requirements for the demo.`);
  const claims = statements.map((statement: string, i: number) => ({ id: `R${i + 1}`, statement }));
  const policyLockId = String(record.payload.metadata?.policyLockId ?? (await ensurePolicyLock()));
  const hint = fixHint(input.fix);
  const resolutions = [...(record.resolutions ?? []), ...resolvedBy(record, statements, hint)].slice(-10);
  record.resolutions = resolutions;
  record.payload = buildPayload(record, title, claims, policyLockId, resolutions);
  const hash = await computeCanonicalPayloadHash(record.payload);
  if (hash !== record.payloadHash) {
    record.payloadHash = hash;
    record.attestations = [];
    record.modelReviews = [];
  }
  record.updatedAt = Date.now();
  await getStore().saveRecord(record);
  return record;
}

const ISSUE_TYPES: IssueType[] = ["conflict", "ambiguity", "gap", "risk"];

export function normaliseReview(raw: Record<string, unknown>, validIds: Set<string>): Pick<ModelReview, "decision" | "summary" | "issues"> {
  const issues: ReviewIssue[] = (Array.isArray(raw.issues) ? raw.issues : [])
    .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    .map((i) => {
      const type = ISSUE_TYPES.includes(i.type as IssueType) ? (i.type as IssueType) : "risk";
      const severity: IssueSeverity = type === "conflict" || i.severity === "blocker" ? "blocker" : "minor";
      const rid = String(i.requirementId ?? "general");
      return {
        requirementId: validIds.has(rid) ? rid : "general",
        type,
        severity,
        detail: String(i.detail ?? "").slice(0, 600),
        policyRef: typeof i.policyRef === "string" ? i.policyRef.slice(0, 12) : undefined,
      };
    })
    .filter((i) => i.detail)
    .slice(0, 12);
  // Enforce the rule ourselves: any blocker means REJECT.
  const decision = issues.some((i) => i.severity === "blocker") ? "REJECT" : "APPROVE";
  return { decision, summary: String(raw.summary ?? "").slice(0, 400), issues };
}

export async function reviewWith(
  provider: ProviderConfig,
  record: Pick<DemoRecord, "payload" | "payloadHash">,
  policyClaims: KnowledgeClaim[] = POLICY_PAYLOAD.claims,
  system: string = REVIEW_SYSTEM
): Promise<ModelReview> {
  const started = Date.now();
  const base = { provider: provider.id, model: provider.model, subjectHash: record.payloadHash, issues: [] as ReviewIssue[] };
  try {
    const raw = await callModelJson(provider, {
      task: "review",
      schema: REVIEW_SCHEMA,
      system,
      user: reviewUser(policyClaims, record.payload.claims, record.payload.title),
      maxTokens: 3000,
    });
    const validIds = new Set(record.payload.claims.map((c) => c.id));
    const review = normaliseReview(raw, validIds);
    return { ...base, ...review, status: "ok", durationMs: Date.now() - started, stub: !provider.apiKey };
  } catch (err) {
    return { ...base, status: "error", error: (err as Error).message.slice(0, 300), durationMs: Date.now() - started };
  }
}

/** Sends the current content to every configured model in parallel. */
export async function runReview(id: string, ip: string): Promise<DemoRecord> {
  const record = await getRecordOrThrow(id);
  assertDraft(record);
  const providers = providerConfigs().filter(isConfigured);
  if (providers.length === 0) throw new DemoError("No AI providers are configured on the server.", 503);
  await chargeModelCalls(ip, providers.length);

  const reviews = await Promise.all(providers.map((p) => reviewWith(p, record)));

  // Re-read: the content may have been edited while the models were working.
  const latest = await getRecordOrThrow(id);
  if (latest.payloadHash !== record.payloadHash || latest.status !== "draft") {
    throw new DemoError("The requirements changed during review. Run the review again.", 409);
  }

  mergeReviews(latest, reviews);
  latest.updatedAt = Date.now();
  await getStore().saveRecord(latest);
  return latest;
}

/** Replaces each reviewing model's earlier review and attestation with the new one. */
export function mergeReviews(latest: Pick<DemoRecord, "modelReviews" | "attestations">, reviews: ModelReview[]): void {
  const reviewed = new Set(reviews.map((r) => r.provider));
  latest.modelReviews = [...latest.modelReviews.filter((r) => !reviewed.has(r.provider)), ...reviews];
  latest.attestations = latest.attestations.filter((a) => !(a.attestorType === "model" && reviewed.has(a.provider as never)));
  for (const r of reviews) {
    if (r.status !== "ok" || !r.decision) continue;
    const attestationId = `att-${r.provider}-${newId()}`;
    r.attestationId = attestationId;
    latest.attestations.push({
      attestationId,
      attestorType: "model",
      attestorId: r.model,
      provider: r.provider,
      role: "independent_reviewer",
      timestamp: Date.now(),
      decision: r.decision,
      metrics: {},
      reasoning: r.summary,
      disagreements: r.issues.map((i) => `${i.requirementId} ${i.type} (${i.severity}): ${i.detail}`),
      subjectHash: r.subjectHash,
      isLive: !r.stub,
    });
  }
}

/** Asks the model that objected to a requirement to propose compliant wording. Nothing is changed until accepted. */
export async function suggestFix(id: string, input: { requirementId?: unknown; provider?: unknown }, ip: string): Promise<FixSuggestion> {
  const record = await getRecordOrThrow(id);
  assertDraft(record);
  const target = record.payload.claims.find((c) => c.id === input.requirementId);
  if (!target) throw new DemoError("Requirement not found.");
  const reviews = record.modelReviews.filter((r) => r.status === "ok" && r.subjectHash === record.payloadHash);
  const objecting = reviews.filter((r) => r.issues.some((i) => i.requirementId === target.id));
  if (objecting.length === 0) throw new DemoError("No model raised an issue with this requirement.");
  const requested = objecting.find((r) => r.provider === input.provider) ?? objecting[0];
  const providers = providerConfigs().filter(isConfigured);
  const provider = providers.find((p) => p.id === requested.provider) ?? pickAgentProvider();
  const issues = (objecting.find((r) => r.provider === provider.id) ?? requested).issues.filter(
    (i) => i.requirementId === target.id
  );

  await chargeModelCalls(ip, 1);
  const raw = await callModelJson(provider, {
    task: "fix",
    schema: FIX_SCHEMA,
    system: FIX_SYSTEM,
    user: fixUser(POLICY_PAYLOAD.claims, record.payload.claims, target, issues),
    maxTokens: 800,
  });
  const statement = String(raw.statement ?? "").trim().slice(0, MAX_STATEMENT);
  if (!statement) throw new DemoError("The model did not propose any wording. Try again.", 502);
  return {
    requirementId: target.id,
    statement,
    explanation: String(raw.explanation ?? "").slice(0, 400),
    provider: provider.id,
    model: provider.model,
    stub: !provider.apiKey,
  };
}

export async function signOff(id: string, input: { role?: unknown; decision?: unknown; comment?: unknown }): Promise<DemoRecord> {
  const record = await getRecordOrThrow(id);
  assertDraft(record);
  const stakeholder = STAKEHOLDERS.find((s) => s.role === input.role);
  if (!stakeholder) throw new DemoError("Unknown stakeholder.");
  if (input.decision !== "APPROVE" && input.decision !== "REJECT") throw new DemoError("Choose approve or request changes.");
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 400) : "";
  if (input.decision === "REJECT" && !comment) throw new DemoError("Say what needs to change.");

  record.attestations = record.attestations.filter((a) => !(a.attestorType === "human" && a.role === stakeholder.role));
  record.attestations.push({
    attestationId: `att-${stakeholder.role}-${newId()}`,
    attestorType: "human",
    attestorId: `${stakeholder.name} (${stakeholder.title})`,
    role: stakeholder.role as Role,
    timestamp: Date.now(),
    decision: input.decision,
    metrics: {},
    reasoning: comment || undefined,
    subjectHash: record.payloadHash,
  });
  record.updatedAt = Date.now();
  await getStore().saveRecord(record);
  return record;
}

export async function lockRecord(id: string): Promise<string> {
  const store = getStore();
  const record = await getRecordOrThrow(id);
  assertDraft(record);
  const evaluation = evaluateConsensus(record.attestations, REQUIREMENTS_POLICY, record.payloadHash);
  if (!evaluation.passed) throw new DemoError(`Not ready to lock: ${evaluation.failures.join(" ")}`, 409);

  if (record.parentLockId && (await store.getSupersededBy(record.parentLockId))) {
    throw new DemoError("The previous version has already been replaced by another change.", 409);
  }

  const key = await getAuthorityKey();
  const block = await createKnowledgeLock({
    payload: record.payload,
    attestations: record.attestations,
    policy: REQUIREMENTS_POLICY,
    parentLockId: record.parentLockId,
    authorityPrivateKey: key.privateKey,
    authorityPublicKey: key.publicKey,
  });
  await store.insertLock(block, record.id);
  if (record.parentLockId) await store.insertSupersession(record.parentLockId, block.lockId);

  record.status = "locked";
  record.lockId = block.lockId;
  record.updatedAt = Date.now();
  await store.saveRecord(record);
  return block.lockId;
}

// ---------- Locks ----------

export interface LockView {
  block: KnowledgeLockBlock;
  verification: VerificationResult;
  supersededBy: string | null;
  isPolicy: boolean;
  policyLockId: string;
  authorityEphemeral: boolean;
  modelsLive: boolean;
}

export async function getLockView(lockId: string): Promise<LockView | null> {
  const store = getStore();
  const policyLockId = await ensurePolicyLock();
  const block = await store.getLock(lockId);
  if (!block) return null;
  const key = await getAuthorityKey();
  return {
    block,
    verification: await verifyKnowledgeLock(block),
    supersededBy: await store.getSupersededBy(lockId),
    isPolicy: lockId === policyLockId,
    policyLockId,
    authorityEphemeral: key.ephemeral,
    modelsLive: !stubEnabled(),
  };
}

export function pickAgentProvider(): ProviderConfig {
  const preferred = (process.env.KL_AGENT_PROVIDER as ProviderConfig["id"]) || "anthropic";
  const all = providerConfigs().filter(isConfigured);
  const p = all.find((x) => x.id === preferred) ?? all[0];
  if (!p) throw new DemoError("No AI providers are configured on the server.", 503);
  return p;
}

async function requireRequirementsLock(lockId: string): Promise<KnowledgeLockBlock> {
  const block = await getStore().getLock(lockId);
  if (!block) throw new DemoError("Locked record not found.", 404);
  if (lockId === (await ensurePolicyLock())) throw new DemoError("Open a requirements record to use the agent.");
  const check = await verifyKnowledgeLock(block);
  if (!check.valid) throw new DemoError("This record failed verification, so the agent will not use it.", 409);
  return block;
}

export async function askAgent(lockId: string, question: unknown, ip: string) {
  const q = typeof question === "string" ? question.trim().slice(0, MAX_QUESTION) : "";
  if (!q) throw new DemoError("Ask a question.");
  const block = await requireRequirementsLock(lockId);
  const provider = pickAgentProvider();
  await chargeModelCalls(ip, 1);
  const raw = await callModelJson(provider, {
    task: "ask",
    schema: ASK_SCHEMA,
    system: ASK_SYSTEM,
    user: askUser(POLICY_PAYLOAD.claims, block.payload.claims, block.lockId, q),
    maxTokens: 1000,
  });
  const known = new Set([...block.payload.claims, ...POLICY_PAYLOAD.claims].map((c) => c.id));
  return {
    answer: String(raw.answer ?? "").slice(0, 1200),
    citations: (Array.isArray(raw.citations) ? raw.citations : []).map(String).filter((c) => known.has(c)),
    covered: raw.covered !== false,
    model: provider.model,
    provider: provider.id,
    stub: !provider.apiKey,
  };
}

export async function checkDrift(lockId: string, work: unknown, ip: string) {
  const text = typeof work === "string" ? work.trim().slice(0, MAX_WORK_ITEM) : "";
  if (!text) throw new DemoError("Paste a ticket or spec to check.");
  const block = await requireRequirementsLock(lockId);
  const provider = pickAgentProvider();
  await chargeModelCalls(ip, 1);
  const raw = await callModelJson(provider, {
    task: "drift",
    schema: DRIFT_SCHEMA,
    system: DRIFT_SYSTEM,
    user: driftUser(POLICY_PAYLOAD.claims, block.payload.claims, text),
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

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
