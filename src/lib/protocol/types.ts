/**
 * Knowledge Lock Protocol (KLP) Core Types
 * Designed to be zero-dependency, runtime-agnostic, and pluggable across stacks.
 */

export type HashAlgorithm = "SHA-256" | "BLAKE3" | "KECCAK-256";
export type SignatureAlgorithm = "Ed25519" | "ECDSA-secp256k1" | "BLS12-381" | "HMAC-SHA256";

/**
 * Standard Knowledge Claim or Statement
 */
export interface KnowledgeClaim {
  id: string;
  statement: string;
  category?: string;
  citations?: string[];
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * The inner knowledge payload to be locked.
 * Can contain structured claims, raw text/markdown, code snippets, or vector roots.
 */
export interface KnowledgePayload {
  schemaVersion: "1.0.0";
  title: string;
  domain: string;
  summary?: string;
  claims: KnowledgeClaim[];
  rawContent?: string;
  semanticRoot?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Attestor entity category
 */
export type AttestorType = "model" | "human" | "oracle" | "automated_test";

/**
 * Model Evaluation Metrics
 */
export interface EvaluationMetrics {
  factuality: number;          // 0.0 - 1.0
  logicalConsistency: number;  // 0.0 - 1.0
  citationValidity?: number;   // 0.0 - 1.0
  hallucinationRisk?: number;  // 0.0 - 1.0 (0 is best)
  relevance?: number;          // 0.0 - 1.0
  custom?: Record<string, number>;
}

/**
 * Individual Attestation from an LLM, Human Expert, or Validator
 */
export interface Attestation {
  attestationId: string;
  attestorType: AttestorType;
  attestorId: string;          // e.g. "gemini-2.5-pro", "claude-3-7-sonnet", "did:key:z6M..."
  provider?: string;           // e.g. "google", "anthropic", "ethereum"
  role?: string;               // e.g. "red_team_critic", "domain_expert", "compliance"
  timestamp: number;
  decision: "APPROVE" | "REJECT" | "ABSTAIN";
  metrics: EvaluationMetrics;
  reasoning?: string;
  disagreements?: string[];
  signatureAlgorithm?: SignatureAlgorithm;
  signature?: string;          // Hex or base64 signature
  publicKey?: string;          // Public key or DID to verify attestation signature
}

/**
 * Consensus Policy configuration specifying validation thresholds
 */
export interface ConsensusPolicy {
  policyId: string;
  name: string;
  description?: string;
  
  // Model Quorum rules
  modelRules: {
    minDistinctModels: number;      // e.g., 3 models required
    minDistinctProviders?: number;  // e.g., at least 2 distinct vendors (Google + Anthropic)
    minAverageFactuality: number;   // e.g., 0.90
    minAverageLogicalConsistency: number; // e.g., 0.90
    maxAllowedHallucinationRisk?: number; // e.g., 0.10
    requiredModels?: string[];      // specific models that must participate
  };

  // Human Quorum rules
  humanRules: {
    required: boolean;
    minApprovals: number;           // e.g. 2 human expert sign-offs
    requiredRoles?: string[];       // e.g. ["domain_expert", "security_officer"]
    allowVeto: boolean;             // If true, 1 REJECT fails consensus
  };

  // Cryptographic requirements
  cryptoRules: {
    hashAlgorithm: HashAlgorithm;
    requireSignedAttestations: boolean;
  };
}

/**
 * Result of evaluating consensus against a policy
 */
export interface ConsensusEvaluationResult {
  passed: boolean;
  timestamp: number;
  policyId: string;
  metrics: {
    totalAttestations: number;
    modelApprovals: number;
    modelRejections: number;
    distinctModelCount: number;
    distinctProviderCount: number;
    avgFactuality: number;
    avgLogicalConsistency: number;
    avgHallucinationRisk: number;
    humanApprovals: number;
    humanRejections: number;
    humanVetoTriggered: boolean;
  };
  failures: string[];
  warnings: string[];
}

/**
 * Complete Locked Knowledge Block (K-Block)
 */
export interface KnowledgeLockBlock {
  klockVersion: "1.0.0";
  lockId: string;               // Deterministic content hash of payload
  canonicalHash: string;        // RFC 8785 canonical hash
  hashAlgorithm: HashAlgorithm;
  createdAt: number;
  lockedAt: number;
  parentLockId?: string;        // Optional DAG parent link
  
  payload: KnowledgePayload;
  
  consensus: {
    policy: ConsensusPolicy;
    evaluation: ConsensusEvaluationResult;
    attestations: Attestation[];
  };

  signatures: {
    aggregatedSignature?: string;
    lockAuthoritySignature?: string;
    signerPublicKey?: string;
    algorithm: SignatureAlgorithm;
  };
}
