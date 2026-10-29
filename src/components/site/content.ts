/** Copy for the Knowledge Lock website at knowledge-lock.com, as approved. */

export const SITE_URL = (process.env.NEXT_PUBLIC_KL_DEMO_URL || "https://knowledge-lock.com").replace(/\/$/, "");
export const APP_URL = (process.env.NEXT_PUBLIC_KL_APP_URL || "https://app.knowledge-lock.com").replace(/\/$/, "");
export const GO_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com").replace(/\/$/, "");

export const REQUEST_ACCESS_URL = `${APP_URL}/request-access`;
export const SIGN_IN_URL = `${APP_URL}/signin`;
/** The Guided Orchestration contact form, with "Design partner" already chosen. */
export const TALK_TO_US_URL = `${GO_URL}/?enquiry=design-partner#get-started`;

export const TITLE = "Knowledge Lock: signed-off truth for teams and AI";
export const DESCRIPTION =
  "Stakeholders and AI models agree on requirements, policies and decisions. Knowledge Lock locks the agreed version, so teams and AI agents build from it.";

export type StepId = "propose" | "review" | "lock" | "build";

export const STEPS: { id: StepId; title: string; text: string }[] = [
  { id: "propose", title: "Propose", text: "Your team writes down what needs agreeing, one short statement per line." },
  {
    id: "review",
    title: "Review",
    text: "Several AI models check every line against your policy. When one objects, it says why and suggests new wording. Named people then sign off for themselves.",
  },
  { id: "lock", title: "Lock", text: "The agreed wording is locked and signed, with who agreed it, which models reviewed it, and when." },
  {
    id: "build",
    title: "Build from it",
    text: "Teams and AI agents work from the locked version. Work that departs from it is flagged, and any change goes back through review as a new version.",
  },
];

export const SHOTS: Record<StepId, { caption: string; alt: string; height: number; phoneHeight: number }> = {
  propose: {
    caption: "Your team writes down what needs agreeing, such as requirements, rules, decisions or facts, one short statement per line.",
    alt: "A draft record titled One of these requirements breaks the bank's policy, listing numbered requirements R1 to R5 for an AI complaints assistant.",
    height: 1002,
    phoneHeight: 1242,
  },
  review: {
    caption: "Several AI models check every line against your policy. When one objects, it says why and suggests new wording, and nothing can be locked until it's resolved.",
    alt: "A blocked requirement, R4, showing its current wording, why it breaks policy P1, and suggested replacement wording from Anthropic with a button to use it and review again.",
    height: 1147,
    phoneHeight: 1720,
  },
  lock: {
    caption: "Once the AI reviewers and your named signers approve, the exact wording is locked and signed, with who agreed it and when.",
    alt: "A locked record marked Locked v1, headed Locked. This is now the signed-off version, with its seven requirements listed.",
    height: 1259,
    phoneHeight: 1216,
  },
  build: {
    caption: "Teams and AI agents work from the locked version. Tickets, specs and Jira issues are checked against it, and anything that departs from it is flagged.",
    alt: "The Build from it tab, checking a backlog ticket against the locked record. Two findings: the ticket departs from R1, and an auto-close rule isn't covered.",
    height: 1221,
    phoneHeight: 1362,
  },
};

export const CHECKS = [
  {
    title: "Locked records never change",
    text: "A change is a new version, with its own review and sign-off, and the earlier version stays there to compare.",
  },
  { title: "Anyone can verify a record", text: "Each locked record is signed, so anyone can check it hasn't changed without having to trust us." },
  { title: "AI reviews, people decide", text: "AI models check and suggest. Named people make the final decision and stay accountable for it." },
];

export const USE_CASES = [
  { title: "Requirements sign-off", text: "Lock the spec before AI-assisted build starts, so every team and agent works from the same version." },
  { title: "Policy for AI agents", text: "The approved version of what an agent may say or do, and who approved it." },
  { title: "Audit evidence", text: "What was agreed, by whom and by which models, and when. Ready for regulators and internal risk." },
  { title: "Cross-unit decisions", text: "One record of truth when business units plan and deliver in different ways." },
];

export const INTEGRATIONS = [
  { title: "Jira", text: "Check issues against a locked record, re-check them automatically when they change, and create one issue per requirement." },
  { title: "Slack and Microsoft Teams", text: "Notices when something needs signing off, or has been locked or retired." },
  { title: "API", text: "Your AI agents read locked records, ask questions answered only from them, and check their work for drift." },
];

export const FAQS = [
  {
    question: "What is Knowledge Lock?",
    answer:
      "Knowledge Lock records what stakeholders and multiple AI models have agreed on, such as requirements, policies or decisions, then locks it cryptographically. Teams and agents build from the locked version, and any change reopens review instead of silently drifting.",
  },
  {
    question: "How is this different from an approval workflow or a shared wiki?",
    answer:
      "An approval workflow records that someone clicked approve, and a wiki can be edited by anyone at any time. Knowledge Lock has multiple AI models and named people review the content itself, locks the agreed version so any change is detectable, and gives teams and AI agents that exact version to work from.",
  },
  {
    question: "Who is it for?",
    answer:
      "Organisations where several business units, or business and engineering teams, need to work from the same agreed requirements, policies and decisions. It matters most in regulated sectors such as the public sector and financial services, where you need to show what was agreed and by whom.",
  },
  {
    question: "What does a design partner pilot involve?",
    answer:
      "A hosted pilot of Knowledge Lock, scoped with you around a real piece of work, at a discounted rate. In return we ask for regular feedback and agreement on publishing a case study when it is done.",
  },
  {
    question: "Is it hosted, or can we run it ourselves?",
    answer:
      "Knowledge Lock starts as a hosted product. Private deployment for organisations that need it is on the roadmap, and we can discuss your requirements during a pilot.",
  },
];
