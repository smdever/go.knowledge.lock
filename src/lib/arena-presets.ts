import { KnowledgePayload, ConsensusPolicy, Attestation } from "./protocol/types";

export interface ArenaPreset {
  id: string;
  name: string;
  category: string;
  department: string;
  dealSize: string;
  badge: "Pass Flow" | "AI Flagged / Blocked" | "Custom Mode";
  description: string;
  stakeholder: {
    name: string;
    title: string;
    role: string;
    did: string;
  };
  payload: KnowledgePayload;
  policy: ConsensusPolicy;
  mockAttestations: Attestation[];
}

export interface CustomTemplate {
  id: string;
  label: string;
  title: string;
  department: string;
  dealSize: string;
  stakeholderName: string;
  stakeholderTitle: string;
  summary: string;
  claims: {
    statement: string;
    citations: string[];
    confidence: number;
  }[];
}

export const CUSTOM_MATTER_TEMPLATES: CustomTemplate[] = [
  {
    id: "vc-term-sheet",
    label: "Venture Financing Term Sheet",
    title: "Series B Preferred Stock Purchase Agreement & Liquidation Rights",
    department: "Venture Capital & Corporate Development",
    dealSize: "$25M Equity Financing",
    stakeholderName: "Rachel Torres",
    stakeholderTitle: "General Partner & Investment Committee Chair",
    summary:
      "Audit of 1.0x non-participating liquidation preference, broad-based weighted-average anti-dilution provisions, and board seat covenants prior to closing.",
    claims: [
      {
        statement:
          "Series B Preferred Stock carries a 1.0x non-participating liquidation preference senior to Common Stock, converting to Common at any time on a 1:1 ratio.",
        citations: ["NVCA-Model-Term-Sheet-2025.pdf", "Series-B-Subscription-Schedule.docx"],
        confidence: 0.98,
      },
      {
        statement:
          "Down-round price protection is strictly limited to broad-based weighted average anti-dilution, with full ratchet rights expressly waived in the charter.",
        citations: ["Term-Sheet-Exhibit-D", "CapTable-Post-Closing-Pro-Forma"],
        confidence: 0.97,
      },
    ],
  },
  {
    id: "healthcare-ai",
    label: "Healthcare AI / HIPAA DPA",
    title: "Clinical Decision Support AI: HIPAA & PHI Data Processing Addendum",
    department: "Healthcare Compliance & Clinical Operations",
    dealSize: "Enterprise Hospital Network Agreement",
    stakeholderName: "Dr. David Sterling",
    stakeholderTitle: "Chief Medical Information Officer (CMIO)",
    summary:
      "Independent verification of zero-retention PHI processing, automated de-identification under HIPAA Safe Harbor (45 CFR § 164.514), and BAA breach indemnity caps.",
    claims: [
      {
        statement:
          "Patient diagnostic telemetry is cryptographically stripped of all 18 HIPAA Safe Harbor identifiers prior to LLM inference with zero data retention on vendor model servers.",
        citations: ["HIPAA-45CFR-SafeHarbor-Review.pdf", "Hospital-Network-BAA-Addendum-v2"],
        confidence: 0.98,
      },
      {
        statement:
          "Vendor provides statutory breach indemnification capped at $20,000,000 for any direct civil monetary penalties resulting from unauthorized PHI exfiltration.",
        citations: ["Commercial-BAA-Liabilities-Schedule-B", "Third-Party-HITRUST-Certification"],
        confidence: 0.96,
      },
    ],
  },
  {
    id: "cyber-insurance",
    label: "Cyber Risk Underwriting Bond",
    title: "Autonomous AI Underwriting & Catastrophic Cyber Reinsurance Bond",
    department: "Enterprise Risk Management & Insurance",
    dealSize: "$50M Policy Aggregate Limit",
    stakeholderName: "Victoria Thorne",
    stakeholderTitle: "Chief Underwriting Officer (CUO)",
    summary:
      "Multi-agent audit of automated underwriting limits, ransomware extortion sub-limits, and multi-factor authentication warranty preconditions.",
    claims: [
      {
        statement:
          "Automated policy issuance excludes ransomware extortion reimbursement if the policyholder fails to verify phishing-resistant MFA across all administrative accounts.",
        citations: ["Underwriting-Guidelines-Schedule-2025", "Lloyds-Cyber-War-Exclusion-Standard"],
        confidence: 0.97,
      },
      {
        statement:
          "Aggregate annual claim indemnity across corporate subsidiaries is strictly capped at $50,000,000 with mandatory 30-day proof-of-loss forensic audit.",
        citations: ["Reinsurance-Treaty-Agreement-2025", "Forensic-Audit-Protocol-Ex-4"],
        confidence: 0.98,
      },
    ],
  },
];

export const ARENA_PRESETS: ArenaPreset[] = [
  {
    id: "ma-due-diligence",
    name: "M&A Valuation & EBITDA Audit",
    category: "Corporate Finance",
    department: "Corporate Development & Finance",
    dealSize: "$380M Acquisition Value",
    badge: "Pass Flow",
    description: "Multi-LLM audit of post-merger EBITDA calculations, recurring revenue quality, and $18.2M escrow indemnity caps prior to definitive agreement execution.",
    stakeholder: {
      name: "Marcus Vance",
      title: "Chief Financial Officer (CFO)",
      role: "cfo_approver",
      did: "did:corp:cfo-marcus-vance-912a",
    },
    payload: {
      schemaVersion: "1.0.0",
      title: "$380M Cloud Infrastructure Acquisition: EBITDA & Working Capital Verification",
      domain: "corporate-finance.m-and-a",
      summary:
        "Independent verification of target company's trailing twelve-month adjusted EBITDA ($42.5M), customer concentration risk (<8%), and $18.2M third-party indemnity escrow.",
      claims: [
        {
          id: "claim-ebitda",
          statement:
            "Target company's LTM Adjusted EBITDA of $42.5M is fully substantiated across 14 enterprise master service agreements with zero single-customer concentration exceeding 8%.",
          citations: ["Audited-Financials-PwC-2025.pdf", "SEC-10K-Q3-Target", "MSA-Schedule-B-Reconciliation"],
          confidence: 0.99,
        },
        {
          id: "claim-escrow",
          statement:
            "Cross-border tax liabilities and IP indemnities are capped at 12% of enterprise value ($45.6M) with $18.2M deposited into third-party escrow for an 18-month survival period.",
          citations: ["Definitive-Agreement-Draft-v4.docx", "ABA-Private-Target-Deal-Study-2025"],
          confidence: 0.98,
        },
      ],
      tags: ["m-and-a", "corporate-finance", "ebitda-audit", "board-governance"],
    },
    policy: {
      policyId: "ma-financial-governance-v1",
      name: "Tier-1 M&A Governance Policy",
      description: "Requires minimum 3 distinct models across 2 frontier providers, zero hallucination tolerance, and mandatory CFO sign-off.",
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
        requiredRoles: ["cfo_approver"],
        allowVeto: true,
      },
      cryptoRules: {
        hashAlgorithm: "SHA-256",
        requireSignedAttestations: false,
      },
    },
    mockAttestations: [
      {
        attestationId: "att-gemini-ma",
        attestorType: "model",
        attestorId: "gemini-2.5-pro",
        provider: "google",
        role: "financial_auditor",
        timestamp: Date.now() - 36000,
        decision: "APPROVE",
        metrics: {
          factuality: 0.99,
          logicalConsistency: 0.98,
          citationValidity: 1.0,
          hallucinationRisk: 0.01,
        },
        reasoning:
          "EBITDA adjustments conform strictly to standard GAAP reconciliation. Recurring revenue waterfall verifies 96.8% renewal rates across all 14 enterprise MSAs with no single customer exceeding 7.4% of total ARR.",
      },
      {
        attestationId: "att-claude-ma",
        attestorType: "model",
        attestorId: "claude-3-7-sonnet",
        provider: "anthropic",
        role: "deal_counsel",
        timestamp: Date.now() - 34000,
        decision: "APPROVE",
        metrics: {
          factuality: 0.98,
          logicalConsistency: 0.99,
          citationValidity: 0.99,
          hallucinationRisk: 0.01,
        },
        reasoning:
          "Indemnity covenants, survival periods, and $18.2M escrow holdback align with standard ABA private target benchmarks. Cross-border tax indemnities fully isolate the acquiring entity.",
      },
      {
        attestationId: "att-gpt-ma",
        attestorType: "model",
        attestorId: "gpt-4o",
        provider: "openai",
        role: "commercial_risk_auditor",
        timestamp: Date.now() - 32000,
        decision: "APPROVE",
        metrics: {
          factuality: 0.97,
          logicalConsistency: 0.97,
          citationValidity: 0.98,
          hallucinationRisk: 0.02,
        },
        reasoning:
          "Working capital peg of $18.2M accurately offsets normal 45-day accounts receivable cycles. No hidden debt obligations or off-balance-sheet commitments identified in data room schedules.",
      },
    ],
  },
  {
    id: "sec-regulatory-risk",
    name: "SEC Form 10-K & EU AI Act Filing",
    category: "Regulatory & Legal",
    department: "Office of General Counsel & Compliance",
    dealSize: "Statutory 10-K Disclosure",
    badge: "AI Flagged / Blocked",
    description: "Automated compliance screen on AI-drafted risk disclosures regarding high-risk algorithmic categorization under EU and US regulations.",
    stakeholder: {
      name: "Sarah Chen",
      title: "General Counsel & Chief Compliance Officer",
      role: "compliance_officer",
      did: "did:corp:legal-sarah-chen-443b",
    },
    payload: {
      schemaVersion: "1.0.0",
      title: "SEC Form 10-K Item 1A: AI Materiality & EU Regulatory Risk Disclosure",
      domain: "legal.regulatory-compliance",
      summary:
        "AI-generated regulatory disclosure asserting exemption for internal credit underwriting algorithms under Article 6 of the EU AI Act.",
      claims: [
        {
          id: "claim-eu-exemption",
          statement:
            "The company's commercial credit scoring algorithms qualify for full statutory exemption under Article 6 of the EU AI Act because outputs serve strictly internal advisory functions.",
          citations: ["Internal-Legal-Memo-Draft-v1", "Unverified-Advisory-Summary"],
          confidence: 0.28,
        },
      ],
      tags: ["sec-filing", "eu-ai-act", "regulatory-risk", "statutory-disclosure"],
    },
    policy: {
      policyId: "sec-compliance-strict-v1",
      name: "Statutory Legal & Compliance Policy",
      description: "Zero-tolerance hallucination policy. Discrepancies on regulatory statutes trigger automatic consensus failure.",
      modelRules: {
        minDistinctModels: 3,
        minDistinctProviders: 2,
        minAverageFactuality: 0.92,
        minAverageLogicalConsistency: 0.90,
        maxAllowedHallucinationRisk: 0.05,
      },
      humanRules: {
        required: true,
        minApprovals: 1,
        requiredRoles: ["compliance_officer"],
        allowVeto: true,
      },
      cryptoRules: {
        hashAlgorithm: "SHA-256",
        requireSignedAttestations: false,
      },
    },
    mockAttestations: [
      {
        attestationId: "att-claude-sec",
        attestorType: "model",
        attestorId: "claude-3-7-sonnet",
        provider: "anthropic",
        role: "regulatory_specialist",
        timestamp: Date.now() - 25000,
        decision: "REJECT",
        metrics: {
          factuality: 0.16,
          logicalConsistency: 0.24,
          citationValidity: 0.05,
          hallucinationRisk: 0.94,
        },
        reasoning:
          "CRITICAL REGULATORY VIOLATION: EU AI Act Annex III Section 5(b) explicitly classifies AI systems used to evaluate creditworthiness of natural persons as HIGH-RISK. Internal advisory status does NOT exempt the system. Claiming exemption risks statutory fines up to €35,000,000 or 7% of global annual turnover.",
      },
      {
        attestationId: "att-gemini-sec",
        attestorType: "model",
        attestorId: "gemini-2.5-pro",
        provider: "google",
        role: "compliance_auditor",
        timestamp: Date.now() - 24000,
        decision: "REJECT",
        metrics: {
          factuality: 0.19,
          logicalConsistency: 0.28,
          citationValidity: 0.08,
          hallucinationRisk: 0.91,
        },
        reasoning:
          "Direct statutory contradiction. Recital 37 confirms that advisory models influencing lending decisions require mandatory conformity assessments and logging. Filing this text would constitute a material misrepresentation under SEC disclosure rules.",
      },
      {
        attestationId: "att-gpt-sec",
        attestorType: "model",
        attestorId: "gpt-4o",
        provider: "openai",
        role: "securities_counsel",
        timestamp: Date.now() - 22000,
        decision: "REJECT",
        metrics: {
          factuality: 0.22,
          logicalConsistency: 0.31,
          citationValidity: 0.1,
          hallucinationRisk: 0.88,
        },
        reasoning:
          "Severe legal exposure detected. SEC Rule 10b-5 prohibits false or misleading statements in 10-K filings. Publishing an invalid exemption defense exposes executives to direct regulatory enforcement.",
      },
    ],
  },
  {
    id: "procurement-sla",
    name: "Tier-1 Cloud Infrastructure SLA",
    category: "Procurement & IT Ops",
    department: "Strategic Sourcing & Infrastructure",
    dealSize: "$65M Multi-Year Contract",
    badge: "Pass Flow",
    description: "Verification of automated liquidated damages formulas, failover latency bounds (<12ms), and multi-region service commitments in an 8-figure vendor contract.",
    stakeholder: {
      name: "Elena Rostova",
      title: "Chief Procurement Officer (CPO)",
      role: "procurement_officer",
      did: "did:corp:cpo-elena-rostova-781e",
    },
    payload: {
      schemaVersion: "1.0.0",
      title: "Tier-1 Cloud Provider Master Service Agreement & 99.999% SLA Schedule",
      domain: "procurement.enterprise-infrastructure",
      summary:
        "Contractual validation of 99.999% regional uptime commitments, automatic liquidated damages (150% of downtime fees), and <12ms cross-region failover replication.",
      claims: [
        {
          id: "claim-uptime-penalty",
          statement:
            "Vendor guarantees 99.999% regional service availability, with automated liquidated damages equal to 150% of prorated monthly charges for any cumulative outage exceeding 15 minutes in a billing cycle.",
          citations: ["MSA-Exhibit-C-SLA-Terms.pdf", "Commercial-Remedies-Schedule-2025"],
          confidence: 0.98,
        },
        {
          id: "claim-failover-latency",
          statement:
            "Cross-region data replication latency between US-East and US-Central is contractually bounded to <12ms with automated DNS failover executing in under 3.0 seconds.",
          citations: ["Network-Architecture-Addendum-Sec4.pdf", "Third-Party-SOC2-TypeII-Audit"],
          confidence: 0.97,
        },
      ],
      tags: ["cloud-sla", "procurement", "liquidated-damages", "vendor-governance"],
    },
    policy: {
      policyId: "procurement-governance-v1",
      name: "Enterprise Sourcing Governance Policy",
      description: "Requires multi-provider LLM verification of commercial penalty clauses and signed sign-off from Chief Procurement Officer.",
      modelRules: {
        minDistinctModels: 3,
        minDistinctProviders: 2,
        minAverageFactuality: 0.90,
        minAverageLogicalConsistency: 0.90,
        maxAllowedHallucinationRisk: 0.06,
      },
      humanRules: {
        required: true,
        minApprovals: 1,
        requiredRoles: ["procurement_officer"],
        allowVeto: true,
      },
      cryptoRules: {
        hashAlgorithm: "SHA-256",
        requireSignedAttestations: false,
      },
    },
    mockAttestations: [
      {
        attestationId: "att-gemini-proc",
        attestorType: "model",
        attestorId: "gemini-2.5-pro",
        provider: "google",
        role: "sla_invariant_validator",
        timestamp: Date.now() - 15000,
        decision: "APPROVE",
        metrics: {
          factuality: 0.98,
          logicalConsistency: 0.97,
          citationValidity: 0.99,
          hallucinationRisk: 0.02,
        },
        reasoning:
          "Liquidated damages calculation formula is mathematically deterministic. Credit tiers align with contractual uptime tables and billing cycle reconciliations.",
      },
      {
        attestationId: "att-claude-proc",
        attestorType: "model",
        attestorId: "claude-3-7-sonnet",
        provider: "anthropic",
        role: "commercial_contracts_counsel",
        timestamp: Date.now() - 14000,
        decision: "APPROVE",
        metrics: {
          factuality: 0.97,
          logicalConsistency: 0.98,
          citationValidity: 0.97,
          hallucinationRisk: 0.02,
        },
        reasoning:
          "Force majeure exclusions are strictly circumscribed to catastrophic acts of nature and exclude vendor power redundancy failures. Remedy mechanisms are legally enforceable.",
      },
      {
        attestationId: "att-gpt-proc",
        attestorType: "model",
        attestorId: "gpt-4o",
        provider: "openai",
        role: "infrastructure_risk_auditor",
        timestamp: Date.now() - 12000,
        decision: "APPROVE",
        metrics: {
          factuality: 0.96,
          logicalConsistency: 0.95,
          citationValidity: 0.98,
          hallucinationRisk: 0.03,
        },
        reasoning:
          "The 12ms cross-region latency threshold is empirically substantiated by historical SOC2 telemetry and vendor dark fiber capacity agreements.",
      },
    ],
  },
];
