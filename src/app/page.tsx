"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import QRCode from "qrcode";
import {
  ARENA_PRESETS,
  ArenaPreset,
  CUSTOM_MATTER_TEMPLATES,
  CustomTemplate,
} from "@/lib/arena-presets";
import {
  KnowledgePayload,
  Attestation,
  ConsensusPolicy,
  KnowledgeLockBlock,
  createKnowledgeLock,
  verifyKnowledgeLock,
  evaluateConsensus,
  defaultCryptoProvider,
  KnowledgeClaim,
} from "@/lib/protocol";
import {
  ShieldCheck,
  Lock,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Cpu,
  Users,
  Fingerprint,
  Sparkles,
  Flame,
  Briefcase,
  Building2,
  Scale,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Download,
  Award,
  X,
  Globe,
  Zap,
  Key,
} from "lucide-react";

// Default fallback for custom matter
const DEFAULT_CUSTOM_PRESET: ArenaPreset = {
  id: "custom-matter",
  name: "Custom Business Matter",
  category: "Enterprise Custom",
  department: "Strategic Governance",
  dealSize: "$25M Equity Financing",
  badge: "Custom Mode",
  description: "User-defined business matter, contractual claims, and designated executive signer.",
  stakeholder: {
    name: "Rachel Torres",
    title: "General Partner & Investment Committee Chair",
    role: "risk_officer",
    did: "did:corp:custom-signer-901a",
  },
  payload: {
    schemaVersion: "1.0.0",
    title: "Series B Preferred Stock Purchase Agreement & Liquidation Rights",
    domain: "corporate.venture-financing",
    summary:
      "Audit of 1.0x non-participating liquidation preference, broad-based weighted-average anti-dilution provisions, and board seat covenants prior to closing.",
    claims: [
      {
        id: "claim-custom-1",
        statement:
          "Series B Preferred Stock carries a 1.0x non-participating liquidation preference senior to Common Stock, converting to Common at any time on a 1:1 ratio.",
        citations: ["NVCA-Model-Term-Sheet-2025.pdf", "Series-B-Subscription-Schedule.docx"],
        confidence: 0.98,
      },
      {
        id: "claim-custom-2",
        statement:
          "Down-round price protection is strictly limited to broad-based weighted average anti-dilution, with full ratchet rights expressly waived in the charter.",
        citations: ["Term-Sheet-Exhibit-D", "CapTable-Post-Closing-Pro-Forma"],
        confidence: 0.97,
      },
    ],
    tags: ["venture-capital", "custom-matter", "term-sheet", "governance"],
  },
  policy: {
    policyId: "custom-governance-v1",
    name: "Custom Enterprise Governance",
    description: "Requires minimum 3 distinct models across 2 frontier providers, >90% factuality, and executive approval.",
    modelRules: {
      minDistinctModels: 3,
      minDistinctProviders: 2,
      minAverageFactuality: 0.90,
      minAverageLogicalConsistency: 0.90,
      maxAllowedHallucinationRisk: 0.05,
    },
    humanRules: {
      required: true,
      minApprovals: 1,
      requiredRoles: ["risk_officer"],
      allowVeto: true,
    },
    cryptoRules: {
      hashAlgorithm: "SHA-256",
      requireSignedAttestations: false,
    },
  },
  mockAttestations: [],
};

// Generates intelligent attestations for custom input (simulated fallback)
function generateCustomAttestations(
  payload: KnowledgePayload,
  stakeholder: { name: string; title: string }
): Attestation[] {
  const combinedText = payload.claims.map((c) => c.statement).join(" ").toLowerCase();
  const highRiskTriggers = [
    "exempt from",
    "no liability",
    "100% guarantee",
    "zero risk",
    "unlimited indemnity",
    "never fail",
    "without any regulatory",
    "bypass",
  ];

  const hasHighRisk = highRiskTriggers.some((t) => combinedText.includes(t));

  if (hasHighRisk) {
    return [
      {
        attestationId: `att-claude-cust-${Date.now()}`,
        attestorType: "model",
        attestorId: "claude-3-7-sonnet",
        provider: "anthropic",
        role: "legal_and_governance_critic",
        timestamp: Date.now() - 25000,
        decision: "REJECT",
        metrics: {
          factuality: 0.18,
          logicalConsistency: 0.32,
          citationValidity: 0.1,
          hallucinationRisk: 0.93,
        },
        reasoning:
          "CRITICAL RISK IDENTIFIED: Statement asserts categorical liability exemption or absolute guarantee that violates standard commercial law principles. Fails legal enforceability audit.",
        isLive: false,
      },
      {
        attestationId: `att-gemini-cust-${Date.now()}`,
        attestorType: "model",
        attestorId: "gemini-2.5-pro",
        provider: "google",
        role: "factual_integrity_auditor",
        timestamp: Date.now() - 24000,
        decision: "REJECT",
        metrics: {
          factuality: 0.22,
          logicalConsistency: 0.36,
          citationValidity: 0.15,
          hallucinationRisk: 0.89,
        },
        reasoning:
          "Unsubstantiated absolute claim detected. Cannot verify truth value against provided citations and institutional precedents.",
        isLive: false,
      },
      {
        attestationId: `att-gpt-cust-${Date.now()}`,
        attestorType: "model",
        attestorId: "gpt-4o",
        provider: "openai",
        role: "commercial_risk_checker",
        timestamp: Date.now() - 22000,
        decision: "REJECT",
        metrics: {
          factuality: 0.24,
          logicalConsistency: 0.39,
          citationValidity: 0.2,
          hallucinationRisk: 0.86,
        },
        reasoning:
          "Disproportionate counterparty risk. High probability of contractual invalidation or regulatory sanction if executed in current form.",
        isLive: false,
      },
    ];
  }

  return [
    {
      attestationId: `att-gemini-cust-${Date.now()}`,
      attestorType: "model",
      attestorId: "gemini-2.5-pro",
      provider: "google",
      role: "factual_integrity_auditor",
      timestamp: Date.now() - 36000,
      decision: "APPROVE",
      metrics: {
        factuality: 0.98,
        logicalConsistency: 0.97,
        citationValidity: 0.98,
        hallucinationRisk: 0.02,
      },
      reasoning: `Numerical figures and core covenants in "${payload.title}" are logically consistent with cited documentary records. Factual integrity meets consensus threshold.`,
      isLive: false,
    },
    {
      attestationId: `att-claude-cust-${Date.now()}`,
      attestorType: "model",
      attestorId: "claude-3-7-sonnet",
      provider: "anthropic",
      role: "legal_and_governance_critic",
      timestamp: Date.now() - 34000,
      decision: "APPROVE",
      metrics: {
        factuality: 0.97,
        logicalConsistency: 0.98,
        citationValidity: 0.96,
        hallucinationRisk: 0.02,
      },
      reasoning: `Contractual mechanics and risk allocations align with market standard benchmarks. No contradictory indemnity or liability clauses identified for ${stakeholder.title}.`,
      isLive: false,
    },
    {
      attestationId: `att-gpt-cust-${Date.now()}`,
      attestorType: "model",
      attestorId: "gpt-4o",
      provider: "openai",
      role: "commercial_risk_checker",
      timestamp: Date.now() - 32000,
      decision: "APPROVE",
      metrics: {
        factuality: 0.96,
        logicalConsistency: 0.96,
        citationValidity: 0.97,
        hallucinationRisk: 0.03,
      },
      reasoning: `Commercial risk review completed. Identified terms conform to institutional governance policies with no outlier liability vectors.`,
      isLive: false,
    },
  ];
}

export default function ConsensusArenaPage() {
  const [selectedPreset, setSelectedPreset] = useState<ArenaPreset>(ARENA_PRESETS[0]);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customPreset, setCustomPreset] = useState<ArenaPreset>(DEFAULT_CUSTOM_PRESET);

  const [currentPayload, setCurrentPayload] = useState<KnowledgePayload>(ARENA_PRESETS[0].payload);
  const [currentPolicy, setCurrentPolicy] = useState<ConsensusPolicy>(ARENA_PRESETS[0].policy);

  // Live API vs Simulated Engine
  const [auditMode, setAuditMode] = useState<"simulated" | "live">("simulated");
  const [showKeysModal, setShowKeysModal] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>("");
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");

  // Deliberation State
  const [stage, setStage] = useState<"idle" | "evaluating" | "human_voting" | "locked" | "rejected">("idle");
  const [activeAttestations, setActiveAttestations] = useState<Attestation[]>([]);
  const [humanApproved, setHumanApproved] = useState<boolean>(false);
  const [humanVetoed, setHumanVetoed] = useState<boolean>(false);

  // Sealed Block & Tamper state
  const [lockedBlock, setLockedBlock] = useState<KnowledgeLockBlock | null>(null);
  const [isTampered, setIsTampered] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [verificationOutput, setVerificationOutput] = useState<{
    valid: boolean;
    tamperDetected: boolean;
    errors: string[];
  } | null>(null);

  // Certificate Modal & QR Code
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const [copiedHash, setCopiedHash] = useState(false);
  const [authorityKey, setAuthorityKey] = useState<{ publicKey: string; privateKey: string } | null>(null);

  // Initialize Authority Keys on client
  useEffect(() => {
    async function initKeys() {
      try {
        const kp = await defaultCryptoProvider.generateKeyPair();
        setAuthorityKey(kp);
      } catch (e) {
        console.error("Key generation error:", e);
      }
    }
    initKeys();
  }, []);

  // Load stored API keys from localStorage
  useEffect(() => {
    try {
      const g = localStorage.getItem("klock_gemini_key") || "";
      const a = localStorage.getItem("klock_anthropic_key") || "";
      const o = localStorage.getItem("klock_openai_key") || "";
      if (g) setGeminiApiKey(g);
      if (a) setAnthropicApiKey(a);
      if (o) setOpenaiApiKey(o);
    } catch (e) {
      // Ignored in environments where localStorage is restricted
    }
  }, []);

  const handleSaveKeys = () => {
    try {
      localStorage.setItem("klock_gemini_key", geminiApiKey);
      localStorage.setItem("klock_anthropic_key", anthropicApiKey);
      localStorage.setItem("klock_openai_key", openaiApiKey);
    } catch (e) {
      // Ignored
    }
    setShowKeysModal(false);
  };

  const hasConfiguredKeys = Boolean(geminiApiKey || anthropicApiKey || openaiApiKey);

  // Handle Preset Switching
  const handleSelectPreset = (preset: ArenaPreset) => {
    setIsCustomMode(false);
    setSelectedPreset(preset);
    setCurrentPayload(preset.payload);
    setCurrentPolicy(preset.policy);
    setStage("idle");
    setActiveAttestations([]);
    setHumanApproved(false);
    setHumanVetoed(false);
    setLockedBlock(null);
    setIsTampered(false);
    setVerificationOutput(null);
    setQrCodeDataUrl("");
    setShowCertificateModal(false);
  };

  // Switch to Custom Mode
  const handleSelectCustom = () => {
    setIsCustomMode(true);
    setSelectedPreset(customPreset);
    setCurrentPayload(customPreset.payload);
    setCurrentPolicy(customPreset.policy);
    setStage("idle");
    setActiveAttestations([]);
    setHumanApproved(false);
    setHumanVetoed(false);
    setLockedBlock(null);
    setIsTampered(false);
    setVerificationOutput(null);
    setQrCodeDataUrl("");
    setShowCertificateModal(false);
  };

  // Load a quick custom template
  const handleLoadTemplate = (tpl: CustomTemplate) => {
    const updatedPayload: KnowledgePayload = {
      schemaVersion: "1.0.0",
      title: tpl.title,
      domain: `custom.${tpl.id}`,
      summary: tpl.summary,
      claims: tpl.claims.map((c, i) => ({
        id: `claim-tpl-${i + 1}`,
        statement: c.statement,
        citations: c.citations,
        confidence: c.confidence,
      })),
      tags: ["custom", tpl.id],
    };

    const updatedStakeholder = {
      name: tpl.stakeholderName,
      title: tpl.stakeholderTitle,
      role: "risk_officer",
      did: `did:corp:signer-${tpl.id}`,
    };

    const updatedCustom: ArenaPreset = {
      ...customPreset,
      name: tpl.label,
      department: tpl.department,
      dealSize: tpl.dealSize,
      stakeholder: updatedStakeholder,
      payload: updatedPayload,
    };

    setCustomPreset(updatedCustom);
    setSelectedPreset(updatedCustom);
    setCurrentPayload(updatedPayload);
    setStage("idle");
    setActiveAttestations([]);
  };

  // Custom Form field handlers
  const handleUpdateCustomField = (field: "title" | "department" | "dealSize" | "summary", val: string) => {
    if (field === "title") {
      const upPayload = { ...currentPayload, title: val };
      setCurrentPayload(upPayload);
      setCustomPreset((prev) => ({ ...prev, payload: upPayload }));
    } else if (field === "summary") {
      const upPayload = { ...currentPayload, summary: val };
      setCurrentPayload(upPayload);
      setCustomPreset((prev) => ({ ...prev, payload: upPayload }));
    } else if (field === "department") {
      setCustomPreset((prev) => ({ ...prev, department: val }));
    } else if (field === "dealSize") {
      setCustomPreset((prev) => ({ ...prev, dealSize: val }));
    }
  };

  const handleUpdateStakeholder = (field: "name" | "title", val: string) => {
    const updated = { ...selectedPreset.stakeholder, [field]: val };
    setSelectedPreset((prev) => ({ ...prev, stakeholder: updated }));
    setCustomPreset((prev) => ({ ...prev, stakeholder: updated }));
  };

  const handleUpdateClaimStatement = (index: number, statement: string) => {
    const claims = [...currentPayload.claims];
    claims[index] = { ...claims[index], statement };
    const upPayload = { ...currentPayload, claims };
    setCurrentPayload(upPayload);
    setCustomPreset((prev) => ({ ...prev, payload: upPayload }));
  };

  const handleUpdateClaimCitations = (index: number, citationsStr: string) => {
    const citations = citationsStr.split(",").map((s) => s.trim()).filter(Boolean);
    const claims = [...currentPayload.claims];
    claims[index] = { ...claims[index], citations };
    const upPayload = { ...currentPayload, claims };
    setCurrentPayload(upPayload);
    setCustomPreset((prev) => ({ ...prev, payload: upPayload }));
  };

  const handleAddClaim = () => {
    const newClaim: KnowledgeClaim = {
      id: `claim-custom-${Date.now()}`,
      statement: "Enter verifiable contractual covenant, financial metric, or compliance warranty...",
      citations: ["Evidence-Document.pdf"],
      confidence: 0.95,
    };
    const claims = [...currentPayload.claims, newClaim];
    const upPayload = { ...currentPayload, claims };
    setCurrentPayload(upPayload);
    setCustomPreset((prev) => ({ ...prev, payload: upPayload }));
  };

  const handleDeleteClaim = (index: number) => {
    if (currentPayload.claims.length <= 1) return;
    const claims = currentPayload.claims.filter((_, i) => i !== index);
    const upPayload = { ...currentPayload, claims };
    setCurrentPayload(upPayload);
    setCustomPreset((prev) => ({ ...prev, payload: upPayload }));
  };

  // Run Consensus Deliberation simulation or Live API
  const runDeliberation = async () => {
    setStage("evaluating");
    setActiveAttestations([]);
    setLockedBlock(null);
    setIsTampered(false);
    setVerificationOutput(null);
    setHumanApproved(false);
    setHumanVetoed(false);
    setQrCodeDataUrl("");
    setShowCertificateModal(false);

    // If Live API mode selected: Call /api/audit
    if (auditMode === "live") {
      try {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: currentPayload,
            policy: currentPolicy,
            stakeholder: selectedPreset.stakeholder,
            apiKeys: {
              gemini: geminiApiKey,
              anthropic: anthropicApiKey,
              openai: openaiApiKey,
            },
            mode: "live",
          }),
        });

        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }

        const data = await res.json();
        const liveAttestations: Attestation[] = data.attestations || [];

        // Progressive reveal of results
        for (let i = 0; i < liveAttestations.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          setActiveAttestations((prev) => [...prev, liveAttestations[i]]);
        }

        const evalResult = evaluateConsensus(liveAttestations, currentPolicy);
        if (
          evalResult.failures.some(
            (f) =>
              f.includes("model") ||
              f.includes("factuality") ||
              f.includes("hallucination") ||
              f.includes("threshold") ||
              f.includes("diversity")
          )
        ) {
          setStage("rejected");
        } else {
          setStage("human_voting");
        }
        return;
      } catch (err) {
        console.warn("Live API call error, falling back to simulated consensus:", err);
      }
    }

    // Default simulated path
    const attestationsToRun = isCustomMode
      ? generateCustomAttestations(currentPayload, selectedPreset.stakeholder)
      : selectedPreset.mockAttestations;

    for (let i = 0; i < attestationsToRun.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setActiveAttestations((prev) => [...prev, attestationsToRun[i]]);
    }

    const evalResult = evaluateConsensus(attestationsToRun, currentPolicy);

    if (
      evalResult.failures.some(
        (f) =>
          f.includes("model") ||
          f.includes("factuality") ||
          f.includes("hallucination") ||
          f.includes("threshold") ||
          f.includes("diversity")
      )
    ) {
      setStage("rejected");
    } else {
      setStage("human_voting");
    }
  };

  // Handle Human Stakeholder Vote
  const handleHumanVote = async (approved: boolean) => {
    if (!authorityKey) return;

    if (!approved) {
      setHumanVetoed(true);
      const vetoAttestation: Attestation = {
        attestationId: `att-human-veto-${Date.now()}`,
        attestorType: "human",
        attestorId: selectedPreset.stakeholder.did,
        role: selectedPreset.stakeholder.role,
        timestamp: Date.now(),
        decision: "REJECT",
        metrics: { factuality: 0.0, logicalConsistency: 0.0 },
        reasoning: `Revision requested by ${selectedPreset.stakeholder.name} (${selectedPreset.stakeholder.title}).`,
      };
      const updated = [...activeAttestations, vetoAttestation];
      setActiveAttestations(updated);
      setStage("rejected");
      return;
    }

    setHumanApproved(true);
    const humanAtt: Attestation = {
      attestationId: `att-human-approv-${Date.now()}`,
      attestorType: "human",
      attestorId: selectedPreset.stakeholder.did,
      role: selectedPreset.stakeholder.role,
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: { factuality: 1.0, logicalConsistency: 1.0 },
      reasoning: `Formally signed & approved by ${selectedPreset.stakeholder.name} (${selectedPreset.stakeholder.title}) following multi-LLM audit.`,
    };

    const finalAttestations = [...activeAttestations, humanAtt];
    setActiveAttestations(finalAttestations);

    // Cryptographically seal block
    try {
      const block = await createKnowledgeLock({
        payload: currentPayload,
        attestations: finalAttestations,
        policy: currentPolicy,
        authorityPrivateKey: authorityKey.privateKey,
        authorityPublicKey: authorityKey.publicKey,
      });

      setLockedBlock(block);
      setStage("locked");

      // Generate verification QR code
      const verifyUrl = `https://knowledgelock.org/verify?hash=${block.canonicalHash}&lockId=${block.lockId}`;
      try {
        const qrUrl = await QRCode.toDataURL(verifyUrl, {
          width: 200,
          margin: 1,
          color: {
            dark: "#0b1329",
            light: "#ffffff",
          },
        });
        setQrCodeDataUrl(qrUrl);
      } catch (qrErr) {
        console.error("QR Code generation error:", qrErr);
      }

      // Verify immediately
      const initialVerif = await verifyKnowledgeLock(block);
      setVerificationOutput({
        valid: initialVerif.valid,
        tamperDetected: initialVerif.tamperDetected,
        errors: initialVerif.errors,
      });
    } catch (err: unknown) {
      console.error("Lock error:", err);
      setStage("rejected");
    }
  };

  // Simulate Tamper
  const toggleTamper = async () => {
    if (!lockedBlock) return;

    if (!isTampered) {
      // Modify characters in the business payload claims
      const tampered: KnowledgeLockBlock = JSON.parse(JSON.stringify(lockedBlock));
      tampered.payload.claims[0].statement += " [UNAUTHORIZED REVISION: Modified terms without executive consent]";
      setIsTampered(true);
      const verif = await verifyKnowledgeLock(tampered);
      setVerificationOutput({
        valid: verif.valid,
        tamperDetected: verif.tamperDetected,
        errors: verif.errors,
      });
    } else {
      // Restore
      setIsTampered(false);
      const verif = await verifyKnowledgeLock(lockedBlock);
      setVerificationOutput({
        valid: verif.valid,
        tamperDetected: verif.tamperDetected,
        errors: verif.errors,
      });
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const resetSimulation = () => {
    if (isCustomMode) {
      handleSelectCustom();
    } else {
      handleSelectPreset(selectedPreset);
    }
  };

  // Export JSON proof receipt
  const downloadJsonProof = () => {
    if (!lockedBlock) return;
    const blob = new Blob([JSON.stringify(lockedBlock, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-lock-audit-${lockedBlock.canonicalHash.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print/Save as PDF handler
  const handlePrintCertificate = () => {
    setShowCertificateModal(true);
    setTimeout(() => {
      window.print();
    }, 350);
  };

  return (
    <main className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <ShieldCheck size={28} />
          </div>
          <div className={styles.titleArea}>
            <h1>
              <span>Knowledge Lock</span>
              <span className={styles.protocolBadge}>ENTERPRISE AI GOVERNANCE</span>
            </h1>
            <p className={styles.subtitle}>
              Independent multi-LLM cross-examination & cryptographic seal for high-stakes business decisions
            </p>
          </div>
        </div>

        {/* Engine Controls: Live APIs vs Simulated Mode */}
        <div className={styles.engineControls}>
          <div className={styles.modeToggleGroup}>
            <button
              id="mode-simulated-btn"
              className={`${styles.modeBtn} ${auditMode === "simulated" ? styles.modeBtnActive : ""}`}
              onClick={() => setAuditMode("simulated")}
            >
              <Zap size={13} />
              <span>Simulated Demo</span>
            </button>
            <button
              id="mode-live-btn"
              className={`${styles.modeBtn} ${auditMode === "live" ? styles.modeBtnActive : ""}`}
              onClick={() => setAuditMode("live")}
            >
              <Globe size={13} />
              <span>Live Frontier APIs</span>
            </button>
          </div>

          <button
            id="api-keys-config-btn"
            className={`${styles.keysConfigBtn} ${hasConfiguredKeys ? styles.keysConfigBtnSet : ""}`}
            onClick={() => setShowKeysModal(true)}
            title="Configure API Keys for Live Calls"
          >
            <Key size={13} />
            <span>{hasConfiguredKeys ? "API Keys Configured" : "Set API Keys"}</span>
          </button>
        </div>
      </header>

      {/* Simplified 3-Step Flow Guide */}
      <div className={styles.workflowBanner}>
        <div className={`${styles.workflowStep} ${styles.stepActive}`}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepTitle}>
              {isCustomMode ? "Configure Custom Matter" : "Select Business Matter"}
            </span>
            <span className={styles.stepDesc}>Review or edit claims & exposure</span>
          </div>
        </div>
        <div className={styles.workflowDivider}>→</div>
        <div
          className={`${styles.workflowStep} ${
            stage === "evaluating" || stage === "human_voting" || stage === "locked" || stage === "rejected"
              ? styles.stepActive
              : ""
          }`}
        >
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepTitle}>
              {auditMode === "live" ? "Live Multi-AI Audit" : "Simulated Cross-Audit"}
            </span>
            <span className={styles.stepDesc}>
              {auditMode === "live" ? "Parallel Gemini, Claude & GPT API calls" : "Simulated frontier deliberation"}
            </span>
          </div>
        </div>
        <div className={styles.workflowDivider}>→</div>
        <div
          className={`${styles.workflowStep} ${
            stage === "human_voting" || stage === "locked" ? styles.stepActive : ""
          }`}
        >
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepInfo}>
            <span className={styles.stepTitle}>Executive Sign-off & Lock</span>
            <span className={styles.stepDesc}>Sign-off & cryptographic seal</span>
          </div>
        </div>
      </div>

      {/* Preset Selector */}
      <div className={styles.presetSection}>
        <div className={styles.presetLabelRow}>
          <span className={styles.presetLabel}>Select Business Scenario:</span>
          <span className={styles.presetHint}>Switch between standard approvals, safety catches, or your own custom matter</span>
        </div>
        <div className={styles.presetGrid}>
          {ARENA_PRESETS.map((preset) => {
            const isSelected = !isCustomMode && selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                id={`preset-btn-${preset.id}`}
                onClick={() => handleSelectPreset(preset)}
                className={`${styles.presetCard} ${isSelected ? styles.presetCardActive : ""}`}
              >
                <div className={styles.presetCardTop}>
                  <div className={styles.presetIconBox}>
                    {preset.category === "Corporate Finance" ? (
                      <DollarSign size={18} color="#10b981" />
                    ) : preset.category === "Regulatory & Legal" ? (
                      <Scale size={18} color="#f43f5e" />
                    ) : (
                      <Briefcase size={18} color="#00f0ff" />
                    )}
                  </div>
                  <span
                    className={`${styles.presetBadge} ${
                      preset.badge.includes("Blocked") ? styles.badgeRisk : styles.badgePass
                    }`}
                  >
                    {preset.badge}
                  </span>
                </div>
                <div className={styles.presetCardName}>{preset.name}</div>
                <div className={styles.presetCardMeta}>
                  <span>{preset.department}</span>
                  <span className={styles.presetCardDeal}>{preset.dealSize}</span>
                </div>
              </button>
            );
          })}

          {/* 4th Card: Custom Business Matter */}
          <button
            id="preset-btn-custom"
            onClick={handleSelectCustom}
            className={`${styles.presetCard} ${styles.customPresetCard} ${isCustomMode ? styles.presetCardActive : ""}`}
          >
            <div className={styles.presetCardTop}>
              <div className={styles.presetIconBox} style={{ background: "rgba(139, 92, 246, 0.15)" }}>
                <Edit3 size={18} color="#c4b5fd" />
              </div>
              <span className={`${styles.presetBadge} ${styles.badgeCustom}`}>
                Custom Proposal
              </span>
            </div>
            <div className={styles.presetCardName}>+ Custom Business Matter</div>
            <div className={styles.presetCardMeta}>
              <span>Interactive User Input</span>
              <span className={styles.presetCardDeal} style={{ color: "#a78bfa" }}>
                Bring Your Own Matter
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Three Column Arena Grid */}
      <div className={styles.arenaGrid}>
        {/* Column 1: Business Proposal (Preset or Custom Editor) */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <FileCheck size={18} color="#00f0ff" />
              <span>Step 1: Business Proposal</span>
            </h2>
            <span className={styles.cardBadge}>
              {isCustomMode ? "CUSTOM MATTER CONFIG" : selectedPreset.department}
            </span>
          </div>

          {/* If Custom Mode: Show Interactive Form */}
          {isCustomMode ? (
            <div className={styles.customEditor}>
              {/* Quick Template loader */}
              <div className={styles.templateBar}>
                <span className={styles.templateBarLabel}>Load Sample Template:</span>
                <div className={styles.templateButtons}>
                  {CUSTOM_MATTER_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className={styles.templateBtn}
                      onClick={() => handleLoadTemplate(tpl)}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Department */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Matter / Contract Title</label>
                <input
                  type="text"
                  className={styles.customInput}
                  value={currentPayload.title}
                  onChange={(e) => handleUpdateCustomField("title", e.target.value)}
                  placeholder="e.g. Series B Investment Term Sheet"
                />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Department / Category</label>
                  <input
                    type="text"
                    className={styles.customInput}
                    value={selectedPreset.department}
                    onChange={(e) => handleUpdateCustomField("department", e.target.value)}
                    placeholder="e.g. Corporate Finance"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Exposure / Deal Value</label>
                  <input
                    type="text"
                    className={styles.customInput}
                    value={selectedPreset.dealSize}
                    onChange={(e) => handleUpdateCustomField("dealSize", e.target.value)}
                    placeholder="e.g. $25M Value"
                  />
                </div>
              </div>

              {/* Executive Summary */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Executive Summary</label>
                <textarea
                  className={styles.customTextarea}
                  rows={2}
                  value={currentPayload.summary || ""}
                  onChange={(e) => handleUpdateCustomField("summary", e.target.value)}
                  placeholder="Brief summary of the business decision or transaction..."
                />
              </div>

              {/* Designated Signer */}
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Signer Name</label>
                  <input
                    type="text"
                    className={styles.customInput}
                    value={selectedPreset.stakeholder.name}
                    onChange={(e) => handleUpdateStakeholder("name", e.target.value)}
                    placeholder="e.g. Rachel Torres"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Signer Title</label>
                  <input
                    type="text"
                    className={styles.customInput}
                    value={selectedPreset.stakeholder.title}
                    onChange={(e) => handleUpdateStakeholder("title", e.target.value)}
                    placeholder="e.g. Chief Risk Officer"
                  />
                </div>
              </div>

              {/* Claims list */}
              <div className={styles.claimsHeaderRow}>
                <label className={styles.inputLabel}>
                  Verifiable Business Claims ({currentPayload.claims.length})
                </label>
                <button
                  type="button"
                  className={styles.addClaimBtn}
                  onClick={handleAddClaim}
                >
                  <Plus size={13} />
                  <span>Add Claim</span>
                </button>
              </div>

              <div className={styles.claimsList}>
                {currentPayload.claims.map((claim, idx) => (
                  <div key={claim.id} className={styles.customClaimCard}>
                    <div className={styles.customClaimTop}>
                      <span className={styles.claimIndex}>Claim #{idx + 1}</span>
                      {currentPayload.claims.length > 1 && (
                        <button
                          type="button"
                          className={styles.deleteClaimBtn}
                          onClick={() => handleDeleteClaim(idx)}
                          title="Delete Claim"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <textarea
                      className={styles.customClaimTextarea}
                      rows={2}
                      value={claim.statement}
                      onChange={(e) => handleUpdateClaimStatement(idx, e.target.value)}
                      placeholder="Specify the exact factual, financial, or legal claim..."
                    />
                    <div className={styles.citationsInputRow}>
                      <span className={styles.citationsInputLabel}>Sources/Evidence:</span>
                      <input
                        type="text"
                        className={styles.customCitationsInput}
                        value={(claim.citations || []).join(", ")}
                        onChange={(e) => handleUpdateClaimCitations(idx, e.target.value)}
                        placeholder="e.g. Contract-v2.pdf, BoardMinutes.docx"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Safety Catch Tip */}
              <div className={styles.safetyTipCard}>
                <Sparkles size={14} color="#f59e0b" />
                <span>
                  <strong>Tip for testing AI Safety:</strong> Include phrases like <em>"100% guarantee with zero risk"</em> or <em>"exempt from all regulation"</em> to watch the multi-model consensus engine catch and block it!
                </span>
              </div>
            </div>
          ) : (
            /* Standard Preset Read-Only View */
            <>
              <div className={styles.businessHeaderBox}>
                <div className={styles.businessTitle}>{currentPayload.title}</div>
                <div className={styles.dealPill}>{selectedPreset.dealSize}</div>
              </div>

              <div className={styles.summaryBox}>
                <div className={styles.summaryLabel}>Executive Summary</div>
                <p className={styles.summaryText}>{currentPayload.summary}</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Core Business Claims to Verify ({currentPayload.claims.length})
                </label>
                {currentPayload.claims.map((claim, idx) => (
                  <div key={claim.id} className={styles.claimBox}>
                    <div className={styles.claimHeader}>
                      <span className={styles.claimIndex}>Claim #{idx + 1}</span>
                      <span className={styles.claimConfidence}>
                        Confidence: {((claim.confidence ?? 0.9) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className={styles.claimText}>{claim.statement}</p>
                    {claim.citations && (
                      <div className={styles.claimMeta}>
                        <span className={styles.citationLabel}>Evidence / Sources:</span>
                        <div className={styles.citationPills}>
                          {claim.citations.map((cite, i) => (
                            <span key={i} className={styles.citationPill}>
                              {cite}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Governance Requirements Box */}
          <div className={styles.governanceCard}>
            <div className={styles.governanceHeader}>
              <Building2 size={15} color="#8b5cf6" />
              <span>Required Governance Thresholds</span>
            </div>
            <div className={styles.governanceList}>
              <div className={styles.governanceItem}>
                <span>AI Quorum:</span>
                <strong>Min {currentPolicy.modelRules.minDistinctModels} Models across {currentPolicy.modelRules.minDistinctProviders} Providers</strong>
              </div>
              <div className={styles.governanceItem}>
                <span>Accuracy Floor:</span>
                <strong>≥{(currentPolicy.modelRules.minAverageFactuality * 100).toFixed(0)}% Factual Integrity</strong>
              </div>
              <div className={styles.governanceItem}>
                <span>Executive Signer:</span>
                <strong>{selectedPreset.stakeholder.title}</strong>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              id="deliberate-btn"
              className={styles.deliberateBtn}
              onClick={runDeliberation}
              disabled={stage === "evaluating"}
            >
              {stage === "evaluating" ? (
                <>
                  <Sparkles size={16} />
                  <span>
                    {auditMode === "live" ? "Calling Frontier APIs..." : "Cross-Examining Claims..."}
                  </span>
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>
                    {stage === "idle"
                      ? auditMode === "live"
                        ? "Run Live Multi-AI Audit"
                        : "Run Multi-AI Audit"
                      : "Re-Run Multi-AI Audit"}
                  </span>
                </>
              )}
            </button>

            {stage !== "idle" && (
              <button
                className={styles.resetBtn}
                onClick={resetSimulation}
                title="Reset simulation"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </section>

        {/* Column 2: Multi-AI Audit Arena */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <Cpu size={18} color="#8b5cf6" />
              <span>Step 2: Multi-AI Cross-Audit</span>
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span className={styles.cardBadge}>
                {activeAttestations.filter((a) => a.attestorType === "model").length} /{" "}
                {isCustomMode || auditMode === "live" ? 3 : selectedPreset.mockAttestations.length} Models
              </span>
              <span
                className={`${styles.modeBadge} ${
                  auditMode === "live" ? styles.modeBadgeLive : styles.modeBadgeSim
                }`}
              >
                {auditMode === "live" ? "LIVE ENGINE" : "SIMULATED"}
              </span>
            </div>
          </div>

          {activeAttestations.length === 0 && stage !== "evaluating" ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconBox}>
                <Cpu size={36} color="#8b5cf6" />
              </div>
              <h3>Awaiting Audit Initiation</h3>
              <p>
                Click <strong>"Run Multi-AI Audit"</strong> to dispatch this proposal simultaneously to Google
                Gemini, Anthropic Claude, and OpenAI GPT-4o for independent fact-checking and hallucination risk detection.
              </p>
              <div className={styles.providerLogosRow}>
                <span className={`${styles.providerBadge} ${styles.logoGemini}`}>Google Gemini</span>
                <span className={`${styles.providerBadge} ${styles.logoClaude}`}>Anthropic Claude</span>
                <span className={`${styles.providerBadge} ${styles.logoGpt}`}>OpenAI GPT-4o</span>
              </div>
            </div>
          ) : (
            <div className={styles.arenaFeed}>
              {activeAttestations
                .filter((a) => a.attestorType === "model")
                .map((att) => {
                  const logoClass =
                    att.provider === "google"
                      ? styles.logoGemini
                      : att.provider === "anthropic"
                      ? styles.logoClaude
                      : styles.logoGpt;

                  const isApproved = att.decision === "APPROVE";

                  return (
                    <div
                      key={att.attestationId}
                      className={`${styles.modelCard} ${
                        !isApproved ? styles.modelCardRejected : ""
                      }`}
                    >
                      <div className={styles.modelHeader}>
                        <div className={styles.modelIdentity}>
                          <div className={`${styles.modelLogo} ${logoClass}`}>
                            {att.provider?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.modelNameRow}>
                              <span className={styles.modelName}>{att.attestorId}</span>
                              {att.isLive ? (
                                <span className={styles.liveApiBadge}>
                                  <Globe size={11} /> LIVE API
                                </span>
                              ) : (
                                <span className={styles.simulatedBadge}>
                                  <Zap size={11} /> SIMULATED
                                </span>
                              )}
                            </div>
                            <div className={styles.modelRole}>
                              {att.role?.replace(/_/g, " ")} • {att.provider?.toUpperCase()}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`${styles.decisionBadge} ${
                            isApproved ? styles.decisionApproved : styles.decisionRejected
                          }`}
                        >
                          {isApproved ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>{isApproved ? "AUDIT PASSED" : "CRITICAL RISK"}</span>
                        </div>
                      </div>

                      {/* Simplified Metrics Bar */}
                      <div className={styles.metricsGrid}>
                        <div className={styles.metricItem}>
                          <span className={styles.metricName}>Accuracy</span>
                          <span
                            className={styles.metricValue}
                            style={{
                              color: att.metrics.factuality > 0.85 ? "#10b981" : "#f43f5e",
                            }}
                          >
                            {(att.metrics.factuality * 100).toFixed(0)}%
                          </span>
                          <div className={styles.meterTrack}>
                            <div
                              className={styles.meterFill}
                              style={{
                                width: `${att.metrics.factuality * 100}%`,
                                background: att.metrics.factuality > 0.85 ? "#10b981" : "#f43f5e",
                              }}
                            />
                          </div>
                        </div>

                        <div className={styles.metricItem}>
                          <span className={styles.metricName}>Consistency</span>
                          <span
                            className={styles.metricValue}
                            style={{
                              color: att.metrics.logicalConsistency > 0.85 ? "#10b981" : "#f43f5e",
                            }}
                          >
                            {(att.metrics.logicalConsistency * 100).toFixed(0)}%
                          </span>
                          <div className={styles.meterTrack}>
                            <div
                              className={styles.meterFill}
                              style={{
                                width: `${att.metrics.logicalConsistency * 100}%`,
                                background:
                                  att.metrics.logicalConsistency > 0.85 ? "#10b981" : "#f43f5e",
                              }}
                            />
                          </div>
                        </div>

                        <div className={styles.metricItem}>
                          <span className={styles.metricName}>Hallucination Risk</span>
                          <span
                            className={styles.metricValue}
                            style={{
                              color:
                                (att.metrics.hallucinationRisk ?? 0) < 0.1 ? "#10b981" : "#f43f5e",
                            }}
                          >
                            {((att.metrics.hallucinationRisk ?? 0) * 100).toFixed(0)}%
                          </span>
                          <div className={styles.meterTrack}>
                            <div
                              className={styles.meterFill}
                              style={{
                                width: `${(att.metrics.hallucinationRisk ?? 0) * 100}%`,
                                background:
                                  (att.metrics.hallucinationRisk ?? 0) < 0.1 ? "#10b981" : "#f43f5e",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {att.reasoning && (
                        <div className={styles.reasoningBox}>
                          <div className={styles.reasoningTitle}>Audit Finding:</div>
                          <div className={styles.reasoningText}>"{att.reasoning}"</div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Column 3: Executive Sign-off & Tamper-Proof Lock */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <Fingerprint size={18} color="#10b981" />
              <span>Step 3: Executive Sign-off & Lock</span>
            </h2>
            <span className={styles.cardBadge}>AUDIT TRAIL</span>
          </div>

          {/* Status summary */}
          <div className={styles.consensusMeterBox}>
            <div className={styles.meterRow}>
              <span className={styles.meterTitle}>AI Consensus Verdict:</span>
              <span
                className={styles.meterScore}
                style={{
                  color:
                    stage === "locked" || stage === "human_voting"
                      ? "#10b981"
                      : stage === "rejected"
                      ? "#f43f5e"
                      : "#94a3b8",
                }}
              >
                {stage === "locked" || stage === "human_voting"
                  ? "✓ UNANIMOUS QUORUM"
                  : stage === "rejected"
                  ? "✕ AUDIT FAILED / BLOCKED"
                  : "AWAITING AUDIT"}
              </span>
            </div>

            <div className={styles.meterRow}>
              <span className={styles.meterTitle}>Executive Sign-off:</span>
              <span
                className={styles.meterScore}
                style={{
                  color: humanApproved ? "#10b981" : humanVetoed ? "#f43f5e" : "#f59e0b",
                }}
              >
                {humanApproved
                  ? "SIGNED & SEALED"
                  : humanVetoed
                  ? "VETO ISSUED"
                  : "PENDING STAKEHOLDER"}
              </span>
            </div>
          </div>

          {/* Critical Risk Rejection Notice */}
          {stage === "rejected" && (
            <div className={styles.riskAlertBox}>
              <div className={styles.riskAlertHeader}>
                <ShieldAlert size={20} color="#f43f5e" />
                <span>Proposal Refused by AI Governance Protocol</span>
              </div>
              <p className={styles.riskAlertBody}>
                {selectedPreset.id === "sec-regulatory-risk" ? (
                  <>
                    <strong>CRITICAL REGULATORY MISREPRESENTATION PREVENTED:</strong> The AI auditor models
                    unanimously detected that claiming an exemption under Article 6 of the EU AI Act for credit
                    scoring is legally invalid and introduces severe statutory fine exposure.
                  </>
                ) : humanVetoed ? (
                  <>
                    <strong>EXECUTIVE VETO EXERCISED:</strong> The designated stakeholder ({selectedPreset.stakeholder.name})
                    requested revision. The record cannot be sealed without compliance resolution.
                  </>
                ) : (
                  <>
                    <strong>AI SAFETY CIRCUIT-BREAKER TRIGGERED:</strong> The submitted business claims failed to meet
                    factual verification or legal risk standards. The protocol blocked this proposal from being sealed.
                  </>
                )}
              </p>
              <div className={styles.riskCallout}>
                🛡️ <em>Knowledge Lock prevented an unvetted or inaccurate AI generation from reaching executives or regulators.</em>
              </div>
            </div>
          )}

          {/* Human Stakeholder Voting Desk */}
          {stage === "human_voting" && (
            <div className={styles.humanDesk}>
              <div className={styles.deskHeader}>
                <Users size={16} color="#00f0ff" />
                <span>Designated Stakeholder Review</span>
              </div>
              <div className={styles.humanStakeholderCard}>
                <div className={styles.humanInfo}>
                  <span className={styles.humanName}>{selectedPreset.stakeholder.name}</span>
                  <span className={styles.humanTitle}>{selectedPreset.stakeholder.title}</span>
                  <span className={styles.humanRoleBadge}>{selectedPreset.department}</span>
                </div>
                <div className={styles.humanActions}>
                  <button
                    id="vote-approve-btn"
                    className={styles.voteApproveBtn}
                    onClick={() => handleHumanVote(true)}
                  >
                    <Check size={15} />
                    <span>Approve & Seal</span>
                  </button>
                  <button
                    id="vote-veto-btn"
                    className={styles.voteVetoBtn}
                    onClick={() => handleHumanVote(false)}
                  >
                    <XCircle size={15} />
                    <span>Veto</span>
                  </button>
                </div>
              </div>
              <div className={styles.deskNote}>
                All 3 AI engines have validated the claims. Your approval will seal this record into an immutable
                cryptographic certificate.
              </div>
            </div>
          )}

          {/* Locked Certificate View */}
          {stage === "locked" && lockedBlock && (
            <div className={styles.lockCertificate}>
              <div className={styles.lockHeader}>
                <Lock size={18} />
                <span>Cryptographic Audit Seal Active</span>
              </div>

              <div className={styles.certificateSummary}>
                <div className={styles.certRow}>
                  <span>Record Status:</span>
                  <strong style={{ color: "#10b981" }}>IMMUTABLE & VERIFIED</strong>
                </div>
                <div className={styles.certRow}>
                  <span>Approved By:</span>
                  <strong>{selectedPreset.stakeholder.name} ({selectedPreset.stakeholder.title})</strong>
                </div>
                <div className={styles.certRow}>
                  <span>Audit Engine:</span>
                  <span>{lockedBlock.consensus.attestations.some((a) => a.isLive) ? "Live Frontier Models" : "Simulated Consensus"}</span>
                </div>
              </div>

              {/* Official Audit Artifacts & Export Buttons */}
              <div className={styles.certificateArtifactsBox}>
                <button
                  id="view-certificate-btn"
                  className={styles.certActionBtnPrimary}
                  onClick={() => setShowCertificateModal(true)}
                >
                  <Award size={15} />
                  <span>View Official Audit Certificate</span>
                </button>
                <div className={styles.certActionRow}>
                  <button
                    id="print-pdf-btn"
                    className={styles.certActionBtnSecondary}
                    onClick={handlePrintCertificate}
                  >
                    <Printer size={14} />
                    <span>Download PDF Receipt</span>
                  </button>
                  <button
                    id="download-json-btn"
                    className={styles.certActionBtnSecondary}
                    onClick={downloadJsonProof}
                  >
                    <Download size={14} />
                    <span>Export JSON Proof</span>
                  </button>
                </div>
              </div>

              <div className={styles.hashSection}>
                <div className={styles.hashLabelRow}>
                  <span>Cryptographic Fingerprint:</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyHash(lockedBlock.canonicalHash)}
                  >
                    {copiedHash ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHash ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className={styles.hashField}>{lockedBlock.canonicalHash}</div>
              </div>

              {/* Tamper testing simulation */}
              <div className={styles.tamperBox}>
                <div className={styles.tamperHeader}>
                  <Flame size={15} color="#f59e0b" />
                  <span>Tamper-Resistance Demonstration</span>
                </div>
                <p className={styles.tamperExplainer}>
                  Test what happens if an unauthorized actor or rogue process attempts to modify the financial or
                  contract terms after the seal is created:
                </p>

                <button
                  id="tamper-btn"
                  className={`${styles.tamperBtn} ${isTampered ? styles.tamperBtnActive : ""}`}
                  onClick={toggleTamper}
                >
                  <Flame size={14} />
                  <span>{isTampered ? "Restore Original Verified Record" : "Simulate Unauthorized Record Edit"}</span>
                </button>

                {isTampered && verificationOutput && (
                  <div className={styles.tamperAlert}>
                    <strong>🚨 UNAUTHORIZED TAMPERING DETECTED!</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                      Cryptographic hash mismatch. The altered contract payload was immediately flagged and rejected by
                      the audit engine.
                    </div>
                  </div>
                )}

                {!isTampered && verificationOutput?.valid && (
                  <div className={styles.verifiedCheck}>
                    ✓ Cryptographic verification 100% valid. Record is mathematically authentic.
                  </div>
                )}
              </div>

              {/* Collapsible raw JSON */}
              <div className={styles.rawJsonSection}>
                <button
                  className={styles.toggleJsonBtn}
                  onClick={() => setShowRawJson(!showRawJson)}
                >
                  <span>{showRawJson ? "Hide Technical Audit Proof" : "Show Technical Audit Proof (JSON)"}</span>
                  {showRawJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showRawJson && (
                  <pre className={styles.rawJsonViewer}>
                    {JSON.stringify(lockedBlock, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Idle prompt */}
          {stage === "idle" && (
            <div className={styles.idlePanel}>
              <div className={styles.idleIcon}>
                <Lock size={28} />
              </div>
              <p>
                Once the AI audit completes and the designated executive signs off, an immutable cryptographic
                certificate is sealed here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Official Executive Audit Certificate Modal */}
      {showCertificateModal && lockedBlock && (
        <div className={styles.modalBackdrop} onClick={() => setShowCertificateModal(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <Award size={20} color="#10b981" />
                <span>Executive Audit Certificate & Receipt</span>
              </div>
              <div className={styles.modalActions}>
                <button
                  id="print-certificate-btn"
                  className={styles.modalBtnPrimary}
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  id="download-json-modal-btn"
                  className={styles.modalBtnSecondary}
                  onClick={downloadJsonProof}
                >
                  <Download size={15} />
                  <span>Download JSON</span>
                </button>
                <button
                  id="close-modal-btn"
                  className={styles.modalCloseBtn}
                  onClick={() => setShowCertificateModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.modalScrollArea}>
              {/* Printable 1-Page Certificate Document */}
              <div className={styles.certificateDocument} id="printable-certificate">
                {/* Certificate Top Banner */}
                <div className={styles.certDocHeader}>
                  <div className={styles.certBrandRow}>
                    <div className={styles.certLogo}>
                      <ShieldCheck size={32} />
                    </div>
                    <div>
                      <div className={styles.certCompany}>KNOWLEDGE LOCK PROTOCOL</div>
                      <div className={styles.certDocTitle}>
                        OFFICIAL AUDIT CERTIFICATE OF AUTHENTICITY & MULTI-AI CONSENSUS
                      </div>
                    </div>
                  </div>
                  <div className={styles.certBadgeArea}>
                    <span className={styles.certSerialBadge}>
                      SERIAL: CERT-KLOCK-2026-{lockedBlock.canonicalHash.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={styles.certStatusPill}>
                      ● MATHEMATICALLY VERIFIED
                    </span>
                  </div>
                </div>

                <div className={styles.certGrid}>
                  {/* Left Column: Subject Matter & Claims */}
                  <div className={styles.certLeftCol}>
                    <div className={styles.certSection}>
                      <div className={styles.certSectionTitle}>SUBJECT MATTER SPECIFICATION</div>
                      <div className={styles.certMatterTitle}>{lockedBlock.payload.title}</div>
                      <div className={styles.certMetaRow}>
                        <span><strong>Department:</strong> {selectedPreset.department}</span>
                        <span><strong>Declared Value:</strong> {selectedPreset.dealSize}</span>
                        <span><strong>Sealed Timestamp:</strong> {new Date(lockedBlock.lockedAt).toUTCString()}</span>
                      </div>
                      {lockedBlock.payload.summary && (
                        <p className={styles.certSummaryText}>
                          <strong>Executive Summary:</strong> {lockedBlock.payload.summary}
                        </p>
                      )}
                    </div>

                    <div className={styles.certSection}>
                      <div className={styles.certSectionTitle}>
                        CRYPTOGRAPHICALLY SEALED COVENANTS & CLAIMS ({lockedBlock.payload.claims.length})
                      </div>
                      <div className={styles.certClaimsList}>
                        {lockedBlock.payload.claims.map((claim, idx) => (
                          <div key={claim.id} className={styles.certClaimItem}>
                            <div className={styles.certClaimNum}>Covenant #{idx + 1}</div>
                            <div className={styles.certClaimStatement}>{claim.statement}</div>
                            {claim.citations && claim.citations.length > 0 && (
                              <div className={styles.certClaimSources}>
                                Evidence: {claim.citations.join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Multi-AI Consensus Panel & Cryptographic Proof */}
                  <div className={styles.certRightCol}>
                    <div className={styles.certSection}>
                      <div className={styles.certSectionTitle}>MULTI-LLM PEER REVIEW CONSENSUS</div>
                      <div className={styles.certModelsList}>
                        {lockedBlock.consensus.attestations
                          .filter((a) => a.attestorType === "model")
                          .map((att) => (
                            <div key={att.attestationId} className={styles.certModelRow}>
                              <div className={styles.certModelNameBox}>
                                <span className={styles.certModelName}>{att.attestorId}</span>
                                <span className={styles.certModelRole}>({att.role?.replace(/_/g, " ")})</span>
                              </div>
                              <div className={styles.certModelMetrics}>
                                <span>Acc: {((att.metrics.factuality ?? 0.95) * 100).toFixed(0)}%</span>
                                <span>Risk: {(((att.metrics.hallucinationRisk ?? 0.02) * 100)).toFixed(0)}%</span>
                                <strong className={styles.certPassedText}>✓ APPROVED</strong>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className={styles.certSection}>
                      <div className={styles.certSectionTitle}>EXECUTIVE STAKEHOLDER SIGN-OFF</div>
                      <div className={styles.certSignerCard}>
                        <div className={styles.certSignerName}>{selectedPreset.stakeholder.name}</div>
                        <div className={styles.certSignerTitle}>{selectedPreset.stakeholder.title}</div>
                        <div className={styles.certSignerDid}>{selectedPreset.stakeholder.did}</div>
                        <div className={styles.certSignerStatus}>
                          <CheckCircle2 size={13} color="#10b981" />
                          <span>Legally Authorized & Digitally Signed</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.certSection}>
                      <div className={styles.certSectionTitle}>CRYPTOGRAPHIC VERIFICATION & QR CODE</div>
                      <div className={styles.certQrRow}>
                        {qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt="Verification QR Code"
                            className={styles.certQrImg}
                          />
                        ) : (
                          <div className={styles.certQrPlaceholder}>QR Code</div>
                        )}
                        <div className={styles.certCryptoInfo}>
                          <div className={styles.certCryptoLabel}>RFC 8785 Canonical SHA-256 Hash:</div>
                          <div className={styles.certCryptoHash}>{lockedBlock.canonicalHash}</div>
                          <div className={styles.certCryptoLabel}>Ed25519 Authority Signature:</div>
                          <div className={styles.certCryptoSig}>
                            {lockedBlock.signatures.lockAuthoritySignature?.slice(0, 36)}...
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal / Institutional Footer */}
                <div className={styles.certFooter}>
                  <div className={styles.certNotice}>
                    <strong>LEGAL NOTICE & REPUTATION GUARANTEE:</strong> This instrument is cryptographically bound to the canonical JSON representation of the declared covenants using WebCrypto Ed25519 digital signatures. Any subsequent alteration to figures, text, or dates invalidates the mathematical checksum and alerts the Knowledge Lock audit registry.
                  </div>
                  <div className={styles.certWatermark}>
                    VERIFIED BY MULTI-VENDOR CONSENSUS • KNOWLEDGE LOCK INC.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Configuration Modal */}
      {showKeysModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowKeysModal(false)}>
          <div className={styles.keysModalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <Key size={18} color="#00f0ff" />
                <span>Frontier Model API Credentials</span>
              </div>
              <button
                id="close-keys-modal-btn"
                className={styles.modalCloseBtn}
                onClick={() => setShowKeysModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.keysModalBody}>
              <p className={styles.keysModalDesc}>
                Optionally connect your live frontier model API keys for direct, unsimulated cross-audits.
                Keys are stored only in your browser session and transmitted securely to <code>/api/audit</code>.
              </p>

              <div className={styles.keyInputGroup}>
                <label className={styles.keyInputLabel}>
                  <span className={`${styles.providerBadge} ${styles.logoGemini}`}>Google Gemini API Key</span>
                  <span className={styles.keyEnvHint}>or set GEMINI_API_KEY</span>
                </label>
                <input
                  type="password"
                  className={styles.keyInputField}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>

              <div className={styles.keyInputGroup}>
                <label className={styles.keyInputLabel}>
                  <span className={`${styles.providerBadge} ${styles.logoClaude}`}>Anthropic Claude API Key</span>
                  <span className={styles.keyEnvHint}>or set ANTHROPIC_API_KEY</span>
                </label>
                <input
                  type="password"
                  className={styles.keyInputField}
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                />
              </div>

              <div className={styles.keyInputGroup}>
                <label className={styles.keyInputLabel}>
                  <span className={`${styles.providerBadge} ${styles.logoGpt}`}>OpenAI API Key</span>
                  <span className={styles.keyEnvHint}>or set OPENAI_API_KEY</span>
                </label>
                <input
                  type="password"
                  className={styles.keyInputField}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                />
              </div>

              <div className={styles.keysFallbackNote}>
                ⚡ <em>If a key is omitted, Knowledge Lock automatically uses the simulated consensus engine for that provider.</em>
              </div>
            </div>

            <div className={styles.keysModalFooter}>
              <button
                id="save-keys-btn"
                className={styles.modalBtnPrimary}
                onClick={handleSaveKeys}
              >
                <span>Save Credentials & Enable Live Mode</span>
              </button>
              <button
                className={styles.modalBtnSecondary}
                onClick={() => {
                  setGeminiApiKey("");
                  setAnthropicApiKey("");
                  setOpenaiApiKey("");
                  try {
                    localStorage.removeItem("klock_gemini_key");
                    localStorage.removeItem("klock_anthropic_key");
                    localStorage.removeItem("klock_openai_key");
                  } catch (e) {}
                  setShowKeysModal(false);
                }}
              >
                <span>Clear Keys</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
