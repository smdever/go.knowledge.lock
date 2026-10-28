import { fetch } from "@forge/api";
import { kvs } from "@forge/kvs";
import type { Problem, RecordState, RecordSummary } from "./status";

/** Knowledge Lock's address. It's also the only outside address the app is allowed to call (see manifest.yml). */
export const KL_BASE = "https://app.knowledge-lock.com";

const KEY_SECRET = "kl-api-key";
const STATUS_TTL = { value: 2, unit: "MINUTES" as const };

/** The organisation API key, kept in Forge's secret storage. It's never sent to the browser (R1). */
export const getKey = () => kvs.getSecret<string>(KEY_SECRET);
export const saveKey = (key: string) => kvs.setSecret(KEY_SECRET, key);
export const removeKey = () => kvs.deleteSecret(KEY_SECRET);

type Result<T> = { ok: true; data: T } | { ok: false; status: number; code?: string; message?: string };

async function call<T>(path: string, init: { method?: string; body?: unknown; key?: string } = {}): Promise<Result<T> | { ok: false; status: 0; code: "not_configured" }> {
  const key = init.key ?? (await getKey());
  if (!key) return { ok: false, status: 0, code: "not_configured" };
  try {
    const res = await fetch(`${KL_BASE}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: json as T };
    return { ok: false, status: res.status, code: typeof json.code === "string" ? json.code : undefined, message: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false, status: 0 };
  }
}

function problemFrom(r: { status: number; code?: string }): Problem {
  if (r.code === "not_configured") return "not_configured";
  if (r.code === "invalid_key" || r.status === 401) return "invalid_key";
  if (r.code === "not_found" || r.status === 404) return "not_found";
  if (r.code === "rate_limited" || r.status === 429) return "rate_limited";
  return "unreachable";
}

interface LockResponse {
  url: string;
  retired: { retiredAt: string; retiredBy: string; reason: string } | null;
  summary: Omit<RecordSummary, "lockId" | "url" | "retired">;
}

/** The record's current state, kept for two minutes so busy pages don't use up the site's hourly API limit. */
export async function recordState(lockId: string, opts: { fresh?: boolean } = {}): Promise<RecordState> {
  const cacheKey = `status:${lockId}`;
  if (!opts.fresh) {
    const cached = await kvs.get<RecordState>(cacheKey);
    if (cached) return cached;
  }
  const r = await call<LockResponse>(`/locks/${encodeURIComponent(lockId)}`);
  let state: RecordState;
  if (r.ok) {
    state = { kind: "record", record: { ...r.data.summary, lockId, url: r.data.url, retired: r.data.retired } };
  } else if (r.code === "org_closing") {
    state = { kind: "closing", message: ("message" in r && r.message) || "The Knowledge Lock organisation this site is connected to is closing." };
  } else {
    state = { kind: "problem", problem: problemFrom(r), ...("message" in r && r.message ? { message: r.message } : {}) };
  }
  // Only cache answers from Knowledge Lock, so a fixed connection shows up straight away.
  if (state.kind !== "problem" || state.problem === "not_found") await kvs.set(cacheKey, state, { ttl: STATUS_TTL });
  return state;
}

export const forgetState = (lockId: string) => kvs.delete(`status:${lockId}`);

/** Tries a key before it's saved, so an administrator knows straight away if it's wrong (R1). */
export async function testKey(key: string): Promise<{ ok: true } | { ok: false; problem: Problem | "closing"; message?: string }> {
  const r = await call<unknown>("/locks", { key });
  if (r.ok) return { ok: true };
  if (r.code === "org_closing") return { ok: false, problem: "closing", message: "message" in r ? r.message : undefined };
  return { ok: false, problem: problemFrom(r) };
}

export interface Finding {
  requirementId: string;
  kind: "departs" | "not_covered";
  excerpt: string;
  detail: string;
}

/** Runs the drift check (R5). The page text goes to Knowledge Lock for this check only and isn't kept (R7, R8). */
export async function checkDrift(lockId: string, work: string, site?: string) {
  const r = await call<{ summary: string; findings: Finding[] }>(`/locks/${encodeURIComponent(lockId)}/check`, {
    method: "POST",
    body: { work, source: { kind: "confluence", ...(site ? { site } : {}) } },
  });
  if (r.ok) return { ok: true as const, summary: r.data.summary, findings: r.data.findings };
  if (r.code === "org_closing") return { ok: false as const, closing: true, message: "message" in r ? r.message : undefined };
  if (r.code === "retired" || r.status === 410) return { ok: false as const, retired: true, message: "message" in r ? r.message : undefined };
  return { ok: false as const, problem: problemFrom(r), message: "message" in r ? r.message : undefined };
}
