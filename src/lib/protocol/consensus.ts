import { Attestation, ConsensusPolicy, ConsensusEvaluationResult } from "./types";

/**
 * Deterministic consensus evaluation engine.
 * Pure function: Given attestations and a policy, computes whether consensus is met.
 */
export function evaluateConsensus(
  allAttestations: Attestation[],
  policy: ConsensusPolicy,
  subjectHash?: string
): ConsensusEvaluationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // When a subject hash is given, attestations bound to different content do not count.
  const attestations = subjectHash
    ? allAttestations.filter((a) => !a.subjectHash || a.subjectHash === subjectHash)
    : allAttestations;
  const stale = allAttestations.length - attestations.length;
  if (stale > 0) {
    warnings.push(`${stale} attestation(s) were given for a different version of the content and were ignored.`);
  }

  const modelAttestations = attestations.filter((a) => a.attestorType === "model");
  const allHuman = attestations.filter((a) => a.attestorType === "human");
  // Whether each signature is genuine is checked by verifyKnowledgeLock; here, unsigned sign-offs simply don't count.
  const humanAttestations = policy.humanRules.requirePersonalSignatures
    ? allHuman.filter((a) => a.personalSignature)
    : allHuman;
  if (humanAttestations.length < allHuman.length) {
    warnings.push(`${allHuman.length - humanAttestations.length} sign-off(s) had no personal signature and were ignored.`);
  }

  const modelApprovals = modelAttestations.filter((a) => a.decision === "APPROVE");
  const modelRejections = modelAttestations.filter((a) => a.decision === "REJECT");

  const humanApprovals = humanAttestations.filter((a) => a.decision === "APPROVE");
  const humanRejections = humanAttestations.filter((a) => a.decision === "REJECT");

  // Distinct model IDs and distinct providers
  const distinctModels = new Set(modelApprovals.map((a) => a.attestorId));
  const distinctProviders = new Set(
    modelApprovals.map((a) => a.provider).filter((p): p is string => Boolean(p))
  );

  // Model Quorum Check
  if (distinctModels.size < policy.modelRules.minDistinctModels) {
    failures.push(
      `Insufficient distinct approving models: got ${distinctModels.size}, required ${policy.modelRules.minDistinctModels}`
    );
  }

  // Provider Diversity Check
  if (
    policy.modelRules.minDistinctProviders &&
    distinctProviders.size < policy.modelRules.minDistinctProviders
  ) {
    failures.push(
      `Insufficient model provider diversity: got ${distinctProviders.size}, required ${policy.modelRules.minDistinctProviders}`
    );
  }

  // Required Models Check
  if (policy.modelRules.requiredModels?.length) {
    for (const reqModel of policy.modelRules.requiredModels) {
      if (!distinctModels.has(reqModel)) {
        failures.push(`Required model "${reqModel}" did not approve.`);
      }
    }
  }

  // Calculate Metric Averages across approving models
  let avgFactuality = 0;
  let avgLogicalConsistency = 0;
  let avgHallucinationRisk = 0;

  if (modelApprovals.length > 0) {
    const totalFact = modelApprovals.reduce((acc, a) => acc + (a.metrics.factuality ?? 0), 0);
    const totalLogic = modelApprovals.reduce(
      (acc, a) => acc + (a.metrics.logicalConsistency ?? 0),
      0
    );
    const totalHallu = modelApprovals.reduce(
      (acc, a) => acc + (a.metrics.hallucinationRisk ?? 0),
      0
    );

    avgFactuality = totalFact / modelApprovals.length;
    avgLogicalConsistency = totalLogic / modelApprovals.length;
    avgHallucinationRisk = totalHallu / modelApprovals.length;
  }

  if (
    policy.modelRules.minAverageFactuality !== undefined &&
    avgFactuality < policy.modelRules.minAverageFactuality
  ) {
    failures.push(
      `Average model factuality score (${avgFactuality.toFixed(2)}) below required threshold (${policy.modelRules.minAverageFactuality.toFixed(2)})`
    );
  }

  if (
    policy.modelRules.minAverageLogicalConsistency !== undefined &&
    avgLogicalConsistency < policy.modelRules.minAverageLogicalConsistency
  ) {
    failures.push(
      `Average model logical consistency (${avgLogicalConsistency.toFixed(2)}) below required threshold (${policy.modelRules.minAverageLogicalConsistency.toFixed(2)})`
    );
  }

  if (
    policy.modelRules.maxAllowedHallucinationRisk !== undefined &&
    avgHallucinationRisk > policy.modelRules.maxAllowedHallucinationRisk
  ) {
    failures.push(
      `Average hallucination risk (${avgHallucinationRisk.toFixed(2)}) exceeds maximum allowed (${policy.modelRules.maxAllowedHallucinationRisk.toFixed(2)})`
    );
  }

  // Human Quorum Check
  let humanVetoTriggered = false;
  if (policy.humanRules.allowVeto && humanRejections.length > 0) {
    humanVetoTriggered = true;
    failures.push(`Consensus vetoed by ${humanRejections.length} human stakeholder(s).`);
  }

  if (policy.humanRules.required) {
    if (humanApprovals.length < policy.humanRules.minApprovals) {
      failures.push(
        `Insufficient human approvals: got ${humanApprovals.length}, required ${policy.humanRules.minApprovals}`
      );
    }

    if (policy.humanRules.requiredRoles?.length) {
      const approvedRoles = new Set(
        humanApprovals.map((h) => h.role).filter((r): r is string => Boolean(r))
      );
      for (const role of policy.humanRules.requiredRoles) {
        if (!approvedRoles.has(role)) {
          failures.push(`Required human stakeholder role "${role}" has not approved.`);
        }
      }
    }
  }

  if (
    policy.modelRules.maxModelRejections !== undefined &&
    modelRejections.length > policy.modelRules.maxModelRejections
  ) {
    failures.push(
      `${modelRejections.length} model(s) rejected the proposal; at most ${policy.modelRules.maxModelRejections} allowed.`
    );
  } else if (modelRejections.length > 0) {
    warnings.push(`${modelRejections.length} model(s) rejected or flagged the proposal.`);
  }

  return {
    passed: failures.length === 0,
    timestamp: Date.now(),
    policyId: policy.policyId,
    metrics: {
      totalAttestations: attestations.length,
      modelApprovals: modelApprovals.length,
      modelRejections: modelRejections.length,
      distinctModelCount: distinctModels.size,
      distinctProviderCount: distinctProviders.size,
      avgFactuality,
      avgLogicalConsistency,
      avgHallucinationRisk,
      humanApprovals: humanApprovals.length,
      humanRejections: humanRejections.length,
      humanVetoTriggered,
    },
    failures,
    warnings,
    subjectHash,
  };
}
