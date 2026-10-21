import type { ConsensusPolicy, KnowledgePayload } from "@/lib/protocol";
import type { Stakeholder } from "./types";

/**
 * Demo scenario. Halden Bank and everyone named here are fictional.
 */

export const SCENARIO_ID = "halden-complaints-assistant";

export const ORG_NAME = "Halden Bank";

export const STAKEHOLDERS: Stakeholder[] = [
  { role: "product", name: "Priya Shah", title: "Product Owner, Digital Servicing" },
  { role: "compliance", name: "Daniel Okafor", title: "Head of Complaints Compliance" },
  { role: "engineering", name: "Tom Hughes", title: "Engineering Lead, Conversational AI" },
];

/** The already-locked policy the new requirements must respect. */
export const POLICY_PAYLOAD: KnowledgePayload = {
  schemaVersion: "1.0.0",
  title: "Customer complaints policy: use of AI (v3)",
  domain: "halden.policy.complaints",
  summary: "Group policy that every AI tool touching customer complaints must follow.",
  claims: [
    {
      id: "P1",
      statement:
        "AI tools may help customers describe and submit a complaint, but must not decide the outcome of a complaint or promise any redress. Outcomes are decided by a human case handler.",
    },
    {
      id: "P2",
      statement:
        "Customers must be told at the start of every conversation that they are talking to an AI assistant, and must be able to reach a person at any point.",
    },
    {
      id: "P3",
      statement:
        "Where a conversation shows signs that a customer may be vulnerable, for example bereavement, serious illness or financial hardship, the case must be passed to a person in the same session.",
    },
    {
      id: "P4",
      statement:
        "Every complaint must receive a written acknowledgement with a complaint reference within one working day, sent from the case management system.",
    },
    {
      id: "P5",
      statement:
        "Customer personal data may only be processed by AI models hosted in the UK or EU, and must never be used to train models.",
    },
    {
      id: "P6",
      statement: "All AI conversations about complaints are retained for six years for audit.",
    },
  ],
  tags: ["policy", "complaints", "ai"],
  metadata: { organisation: ORG_NAME, seeded: true },
};

export const POLICY_SIGNERS: Stakeholder[] = [
  { role: "compliance", name: "Daniel Okafor", title: "Head of Complaints Compliance" },
  { role: "product", name: "Grace Lindqvist", title: "Chief Operating Officer" },
  { role: "engineering", name: "Marcus Bell", title: "Chief Information Security Officer" },
];

export const DRAFT_TITLE = "Complaints assistant: v1 requirements";

export const DRAFT_REQUIREMENTS: { id: string; statement: string }[] = [
  {
    id: "R1",
    statement:
      "The assistant opens every conversation by saying it is an AI assistant and that the customer can ask for a person at any time.",
  },
  {
    id: "R2",
    statement:
      "The assistant collects the account, what went wrong, when it happened and the outcome the customer wants, then creates a complaint case in the case management system.",
  },
  {
    id: "R3",
    statement:
      "When a case is created, the customer is shown their complaint reference and told a written acknowledgement will follow within one working day.",
  },
  {
    id: "R4",
    statement:
      "To resolve simple complaints faster, the assistant may offer a goodwill payment of up to £25 without involving a case handler.",
  },
  {
    id: "R5",
    statement:
      "If the customer mentions bereavement, serious illness or financial difficulty, the assistant offers an immediate handover to a colleague in the same conversation.",
  },
  {
    id: "R6",
    statement:
      "The assistant uses a language model hosted in the bank's UK cloud region, and conversation data is excluded from model training.",
  },
  {
    id: "R7",
    statement: "Conversation transcripts are attached to the complaint case and retained in line with the complaints policy.",
  },
];


export const SAMPLE_QUESTIONS = [
  "Can the assistant offer a customer a refund?",
  "What should happen if a customer says they have just lost their job?",
  "Where is the language model allowed to run?",
];

export const SAMPLE_TICKET = `CX-482: Speed up complaint intake

As a returning customer I want to get to the point faster.

- Skip the "you are talking to an AI assistant" message for customers who have used the assistant before.
- Auto-close the complaint if the customer has not replied within 48 hours.
- Show the complaint reference on screen once the case is created.`;

/** Rules a requirements record must meet before it can be locked. */
export const REQUIREMENTS_POLICY: ConsensusPolicy = {
  policyId: "halden-requirements-signoff-v1",
  name: "Requirements sign-off",
  description:
    "At least two independent models from different providers approve with no objections, and Product, Compliance and Engineering all sign off.",
  modelRules: {
    minDistinctModels: 2,
    minDistinctProviders: 2,
    maxModelRejections: 0,
  },
  humanRules: {
    required: true,
    minApprovals: 3,
    requiredRoles: ["product", "compliance", "engineering"],
    allowVeto: true,
  },
  cryptoRules: {
    hashAlgorithm: "SHA-256",
    requireSignedAttestations: false,
  },
};

/** Rules used to seed the policy lock (human sign-off only). */
export const SEED_POLICY: ConsensusPolicy = {
  policyId: "halden-policy-signoff-v1",
  name: "Policy sign-off (seeded for the demo)",
  modelRules: { minDistinctModels: 0 },
  humanRules: {
    required: true,
    minApprovals: 3,
    requiredRoles: ["product", "compliance", "engineering"],
    allowVeto: true,
  },
  cryptoRules: { hashAlgorithm: "SHA-256", requireSignedAttestations: false },
};
