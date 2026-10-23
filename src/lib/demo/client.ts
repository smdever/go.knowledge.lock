"use client";

import type { FixSuggestion, ProviderId, RecordView } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong.");
  return data as T;
}

/** The same calls against the demo (`/api`) or the product (`/api/app`). */
export const makeApi = (base: string) => ({
  createRecord: (parentLockId?: string) =>
    request<RecordView>(`${base}/records`, { method: "POST", body: JSON.stringify({ parentLockId }) }),
  getRecord: (id: string) => request<RecordView>(`${base}/records/${id}`),
  updateRecord: (
    id: string,
    title: string,
    requirements: string[],
    fix?: { requirementId: string; provider: ProviderId }
  ) => request<RecordView>(`${base}/records/${id}`, { method: "PATCH", body: JSON.stringify({ title, requirements, fix }) }),
  suggestFix: (id: string, requirementId: string, provider: ProviderId) =>
    request<FixSuggestion>(`${base}/records/${id}/suggest`, {
      method: "POST",
      body: JSON.stringify({ requirementId, provider }),
    }),
  review: (id: string) => request<RecordView>(`${base}/records/${id}/review`, { method: "POST" }),
  signOff: (id: string, role: string, decision: "APPROVE" | "REJECT", comment?: string) =>
    request<RecordView>(`${base}/records/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ role, decision, comment }),
    }),
  lock: (id: string) => request<{ lockId: string }>(`${base}/records/${id}/lock`, { method: "POST" }),
  ask: (lockId: string, question: string) =>
    request<{ answer: string; citations: string[]; covered: boolean; model: string; stub: boolean }>(
      `${base}/locks/${lockId}/ask`,
      { method: "POST", body: JSON.stringify({ question }) }
    ),
  drift: (lockId: string, work: string) =>
    request<{
      summary: string;
      findings: { requirementId: string; kind: "departs" | "not_covered"; excerpt: string; detail: string }[];
      model: string;
      stub: boolean;
    }>(`${base}/locks/${lockId}/drift`, { method: "POST", body: JSON.stringify({ work }) }),
});

export type Api = ReturnType<typeof makeApi>;
export const api = makeApi("/api");
