import { canonicalizeJson } from "./canonicalize";
import { CryptoProvider, defaultCryptoProvider } from "./crypto";
import { evaluateConsensus } from "./consensus";
import {
  KnowledgePayload,
  Attestation,
  ConsensusPolicy,
  KnowledgeLockBlock,
} from "./types";

export interface CreateLockOptions {
  payload: KnowledgePayload;
  attestations: Attestation[];
  policy: ConsensusPolicy;
  parentLockId?: string;
  cryptoProvider?: CryptoProvider;
  authorityPrivateKey?: string; // Optional private key to seal the block
  authorityPublicKey?: string;
}

export interface VerificationResult {
  valid: boolean;
  tamperDetected: boolean;
  consensusSatisfied: boolean;
  signatureValid?: boolean;
  computedHash: string;
  recordedHash: string;
  errors: string[];
}

/**
 * Computes canonical SHA-256 hash of a KnowledgePayload
 */
export async function computeCanonicalPayloadHash(
  payload: KnowledgePayload,
  crypto: CryptoProvider = defaultCryptoProvider
): Promise<string> {
  const canonicalString = canonicalizeJson(payload);
  return await crypto.sha256(canonicalString);
}

/**
 * Creates and cryptographically seals a KnowledgeLockBlock if consensus is met
 */
export async function createKnowledgeLock(
  options: CreateLockOptions
): Promise<KnowledgeLockBlock> {
  const crypto = options.cryptoProvider ?? defaultCryptoProvider;
  
  // 1. Evaluate consensus rules
  const evaluation = evaluateConsensus(options.attestations, options.policy);
  if (!evaluation.passed) {
    throw new Error(
      `Cannot lock knowledge block: consensus threshold not reached. Failures: ${evaluation.failures.join("; ")}`
    );
  }

  // 2. Compute canonical hash of the knowledge payload
  const canonicalHash = await computeCanonicalPayloadHash(options.payload, crypto);

  const createdAt = Date.now();
  const lockedAt = createdAt;

  // 3. Optional authority or threshold signature over canonical hash
  let authoritySig: string | undefined;
  if (options.authorityPrivateKey) {
    authoritySig = await crypto.sign(canonicalHash, options.authorityPrivateKey);
  }

  return {
    klockVersion: "1.0.0",
    lockId: canonicalHash,
    canonicalHash,
    hashAlgorithm: options.policy.cryptoRules.hashAlgorithm,
    createdAt,
    lockedAt,
    parentLockId: options.parentLockId,
    payload: options.payload,
    consensus: {
      policy: options.policy,
      evaluation,
      attestations: options.attestations,
    },
    signatures: {
      lockAuthoritySignature: authoritySig,
      signerPublicKey: options.authorityPublicKey,
      algorithm: "Ed25519",
    },
  };
}

/**
 * Verifies any KnowledgeLockBlock independently
 */
export async function verifyKnowledgeLock(
  block: KnowledgeLockBlock,
  crypto: CryptoProvider = defaultCryptoProvider
): Promise<VerificationResult> {
  const errors: string[] = [];

  // 1. Verify content integrity (tamper detection)
  const computedHash = await computeCanonicalPayloadHash(block.payload, crypto);
  const tamperDetected = computedHash !== block.canonicalHash || computedHash !== block.lockId;
  if (tamperDetected) {
    errors.push(
      `Content digest mismatch! Payload has been altered. Expected ${block.canonicalHash}, computed ${computedHash}`
    );
  }

  // 2. Re-evaluate consensus against recorded policy and attestations
  const evaluation = evaluateConsensus(block.consensus.attestations, block.consensus.policy);
  const consensusSatisfied = evaluation.passed;
  if (!consensusSatisfied) {
    errors.push(`Consensus policy violation: ${evaluation.failures.join("; ")}`);
  }

  // 3. Verify authority signature if present
  let signatureValid: boolean | undefined;
  if (block.signatures.lockAuthoritySignature && block.signatures.signerPublicKey) {
    signatureValid = await crypto.verify(
      block.canonicalHash,
      block.signatures.lockAuthoritySignature,
      block.signatures.signerPublicKey
    );
    if (!signatureValid) {
      errors.push("Invalid lock authority cryptographic signature.");
    }
  }

  return {
    valid: !tamperDetected && consensusSatisfied && (signatureValid !== false),
    tamperDetected,
    consensusSatisfied,
    signatureValid,
    computedHash,
    recordedHash: block.canonicalHash,
    errors,
  };
}
