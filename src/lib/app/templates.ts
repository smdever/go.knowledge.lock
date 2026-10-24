/**
 * Starting points for a first record. Choosing one fills in a real draft that the person edits before
 * review: nothing here is locked or signed as it stands. Generic on purpose, with no client names.
 */
export interface RecordTemplate {
  id: string;
  kind: "requirements" | "policy";
  title: string;
  /** One line on when to use it. */
  summary: string;
  statements: string[];
}

export const TEMPLATES: RecordTemplate[] = [
  {
    id: "ai-assistant",
    kind: "requirements",
    title: "Customer AI assistant: requirements",
    summary: "What a customer-facing AI assistant may and may not do.",
    statements: [
      "The assistant tells customers they are talking to an AI assistant at the start of every conversation.",
      "Customers can ask for a person at any point, and the assistant hands over with a summary of the conversation so far.",
      "The assistant answers only from approved help content and the customer's own account details.",
      "The assistant does not make decisions about refunds, compensation or eligibility. It records the request for a person to decide.",
      "The assistant does not ask for passwords, full card numbers or one-time passcodes.",
      "Conversations are kept for 90 days and then deleted, unless they are linked to an open complaint.",
      "Every answer about a product, price or policy links to the source it came from.",
    ],
  },
  {
    id: "feature-spec",
    kind: "requirements",
    title: "Self-service address change: requirements",
    summary: "A feature spec your product, engineering and risk teams sign off together.",
    statements: [
      "Signed-in customers can change their postal address from their account settings.",
      "The new address is checked against the national address database before it is saved.",
      "The customer confirms the change with a one-time code sent to their registered phone number.",
      "A confirmation is sent to both the old and the new address within one working day.",
      "Address changes are blocked for 30 days after a change to the registered phone number or email.",
      "Every change is recorded with the time, the old and new address, and how it was confirmed.",
    ],
  },
  {
    id: "coding-agent",
    kind: "requirements",
    title: "AI coding agents: what they may change",
    summary: "The boundaries your engineering teams give AI coding agents.",
    statements: [
      "AI coding agents work on a branch and open a pull request. They never push to the main branch.",
      "Every pull request from an agent is reviewed and approved by a person before it is merged.",
      "Agents do not change authentication, payment or permissions code without a named reviewer from the security team.",
      "Agents do not add new third-party dependencies without approval from the team's tech lead.",
      "Agents never read, write or print production secrets, keys or customer data.",
      "Each pull request says which agent and model produced it, and which ticket it was for.",
    ],
  },
  {
    id: "model-choice",
    kind: "requirements",
    title: "Choosing an AI model: decision",
    summary: "Record which model was chosen for a use, why, and on what conditions.",
    statements: [
      "We will use one approved provider's model to draft replies to customers, and a member of staff checks each reply before it's sent.",
      "The provider must not train its models on our data, confirmed in the signed contract.",
      "Data is processed in the UK or the EU.",
      "We will run the agreed evaluation set before switching to any new model version.",
      "The decision is reviewed every six months, or sooner if the provider changes its terms.",
      "If the provider is unavailable, replies are drafted by people as they are today.",
    ],
  },
  {
    id: "ai-use-policy",
    kind: "policy",
    title: "Responsible AI use policy",
    summary: "Starter rules every record is checked against.",
    statements: [
      "People make the final decision on anything that affects a customer's money, eligibility or legal rights.",
      "Customers are always told when they are dealing with AI, and can ask for a person.",
      "Customer personal data is only sent to AI services that are approved and under contract.",
      "AI tools do not store or use customer data to train models.",
      "Every AI system has a named owner who is accountable for how it behaves.",
      "AI outputs that are shown to customers can be traced back to their sources.",
      "Any AI incident affecting customers is reported to the risk team within one working day.",
    ],
  },
  {
    id: "data-policy",
    kind: "policy",
    title: "Customer data and AI policy",
    summary: "Rules for how customer data may be used with AI tools.",
    statements: [
      "Only the minimum customer data needed for a task is shared with an AI tool.",
      "Special category data, such as health or ethnicity, is never sent to an AI tool without a completed data protection impact assessment.",
      "Customer data stays in the UK or the EU.",
      "Customers can ask what data about them was processed by AI, and get an answer within one month.",
      "Data shared with AI tools is deleted when it is no longer needed for the task, and within 90 days at most.",
    ],
  },
];

export const templatesFor = (kind: "requirements" | "policy") => TEMPLATES.filter((t) => t.kind === kind);
export const findTemplate = (id: string | undefined, kind: "requirements" | "policy") =>
  TEMPLATES.find((t) => t.id === id && t.kind === kind) ?? null;
