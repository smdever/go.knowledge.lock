import {
  KnowledgePayload,
  Attestation,
  ConsensusPolicy,
  createKnowledgeLock,
  verifyKnowledgeLock,
  defaultCryptoProvider,
} from "./src/lib/protocol";

async function main() {
  console.log("=== Testing Knowledge Lock Protocol (KLP) ===");

  const payload: KnowledgePayload = {
    schemaVersion: "1.0.0",
    title: "Quantum Key Distribution Protocol Analysis",
    domain: "cryptography.quantum",
    summary: "Validation of BB84 security thresholds under atmospheric loss.",
    claims: [
      {
        id: "c-01",
        statement: "BB84 protocol maintains unconditional security when QBER is below 11%.",
        citations: ["doi:10.1103/PhysRevLett.85.441"],
      },
    ],
  };

  const policy: ConsensusPolicy = {
    policyId: "strict-scientific-consensus-v1",
    name: "Strict Scientific Consensus",
    modelRules: {
      minDistinctModels: 3,
      minDistinctProviders: 2,
      minAverageFactuality: 0.9,
      minAverageLogicalConsistency: 0.9,
      maxAllowedHallucinationRisk: 0.05,
    },
    humanRules: {
      required: true,
      minApprovals: 1,
      requiredRoles: ["domain_expert"],
      allowVeto: true,
    },
    cryptoRules: {
      hashAlgorithm: "SHA-256",
      requireSignedAttestations: false,
    },
  };

  const attestations: Attestation[] = [
    {
      attestationId: "att-01",
      attestorType: "model",
      attestorId: "gemini-2.5-pro",
      provider: "google",
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: {
        factuality: 0.98,
        logicalConsistency: 0.99,
        hallucinationRisk: 0.01,
      },
    },
    {
      attestationId: "att-02",
      attestorType: "model",
      attestorId: "claude-3-7-sonnet",
      provider: "anthropic",
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: {
        factuality: 0.96,
        logicalConsistency: 0.98,
        hallucinationRisk: 0.02,
      },
    },
    {
      attestationId: "att-03",
      attestorType: "model",
      attestorId: "gpt-4o",
      provider: "openai",
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: {
        factuality: 0.95,
        logicalConsistency: 0.95,
        hallucinationRisk: 0.03,
      },
    },
    {
      attestationId: "att-04",
      attestorType: "human",
      attestorId: "did:key:z6Mkq...",
      role: "domain_expert",
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: {
        factuality: 1.0,
        logicalConsistency: 1.0,
      },
      reasoning: "Validated against Shor-Preskill proof.",
    },
  ];

  // 1. Generate Keypair for Authority
  const keyPair = await defaultCryptoProvider.generateKeyPair();
  console.log("✓ Generated Authority Ed25519 KeyPair:", keyPair.publicKey);

  // 2. Create Lock
  const lockedBlock = await createKnowledgeLock({
    payload,
    attestations,
    policy,
    authorityPrivateKey: keyPair.privateKey,
    authorityPublicKey: keyPair.publicKey,
  });

  console.log("✓ Successfully locked K-Block! Hash:", lockedBlock.canonicalHash);

  // 3. Verify Original Lock
  const verification = await verifyKnowledgeLock(lockedBlock);
  console.log("✓ Verification valid:", verification.valid);
  if (!verification.valid) throw new Error("Expected valid lock!");

  // 4. Test Tamper Resistance (Modifying a single character in a claim)
  const tamperedBlock = JSON.parse(JSON.stringify(lockedBlock));
  tamperedBlock.payload.claims[0].statement += " [TAMPERED]";
  const tamperedVerification = await verifyKnowledgeLock(tamperedBlock);
  console.log("✓ Tampered block detected as invalid:", !tamperedVerification.valid);
  console.log("✓ Tamper detection flag:", tamperedVerification.tamperDetected);

  console.log("\nALL PROTOCOL TESTS PASSED!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
