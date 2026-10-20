import type { Attestation, ConsensusEvaluationResult, KnowledgePayload } from "@/lib/protocol";

export type Role = "product" | "compliance" | "engineering";

export interface Stakeholder {
  role: Role;
  name: string;
  title: string;
}

export type ProviderId = "anthropic" | "openai" | "google";

export type IssueType = "conflict" | "ambiguity" | "gap" | "risk";
export type IssueSeverity = "blocker" | "minor";

export interface ReviewIssue {
  requirementId: string; // e.g. "R3", or "general"
  type: IssueType;
  severity: IssueSeverity;
  detail: string;
  policyRef?: string; // e.g. "P1"
}

export interface ModelReview {
  provider: ProviderId;
  model: string;
  status: "ok" | "error";
  subjectHash: string;
  decision?: "APPROVE" | "REJECT";
  summary?: string;
  issues: ReviewIssue[];
  error?: string;
  durationMs: number;
  attestationId?: string;
  stub?: boolean; // true when produced by the local test stub, never in production
}

export interface DemoRecord {
  id: string;
  scenarioId: string;
  version: number;
  parentLockId?: string;
  status: "draft" | "locked";
  lockId?: string;
  createdAt: number;
  updatedAt: number;
  payload: KnowledgePayload;
  payloadHash: string;
  attestations: Attestation[];
  modelReviews: ModelReview[];
}

/** What the API returns for a record: the record plus a live consensus evaluation. */
export interface RecordView {
  record: DemoRecord;
  evaluation: ConsensusEvaluationResult;
  stakeholders: Stakeholder[];
  providers: { id: ProviderId; model: string; configured: boolean }[];
  policyLockId: string;
}
