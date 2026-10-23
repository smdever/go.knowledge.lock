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

/** How an objection raised by a model was resolved before locking. Part of the signed payload. */
export interface Resolution {
  at: number;
  requirementId: string;
  originalStatement: string;
  raisedBy: ProviderId[];
  issues: { provider: ProviderId; type: IssueType; detail: string; policyRef?: string }[];
  outcome: "reworded" | "removed";
  newStatement?: string;
  suggestedBy?: ProviderId;
}

export interface FixSuggestion {
  requirementId: string;
  statement: string;
  explanation: string;
  provider: ProviderId;
  model: string;
  stub: boolean;
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
  resolutions?: Resolution[];
}

/** What the API returns for a record: the record plus a live consensus evaluation. */
export interface RecordView {
  record: DemoRecord;
  evaluation: ConsensusEvaluationResult;
  stakeholders: Stakeholder[];
  // ---- Product only (left out in the demo, which uses its three fixed stakeholders)
  signers?: SignerView[];
  /** How many approvals the lock needs. */
  quorum?: number;
  /** False for viewers: they can read a draft but not change or review it. */
  canEdit?: boolean;
  /** "R" for requirements, "P" for policies. */
  claimPrefix?: string;
  maxClaims?: number;
  kind?: "requirements" | "policy";
  providers: { id: ProviderId; model: string; configured: boolean }[];
  policyLockId: string;
}

/** A person who signs a record off. In the demo, a fictional stakeholder anyone can act for; in the product, a real member. */
export interface SignerView {
  /** Matches the `role` on that person's human attestation: the demo role, or `user:<id>` in the product. */
  key: string;
  name: string;
  title: string;
  email?: string;
  /** Used to colour the demo's avatars. */
  avatarRole?: string;
  /** Whether the person looking at the page can sign for this signer. */
  canSign: boolean;
}
