import type { KnowledgeClaim } from "@/lib/protocol";

const list = (claims: KnowledgeClaim[]) => claims.map((c) => `${c.id}: ${c.statement}`).join("\n");

export const REVIEW_SYSTEM = `You are an independent reviewer in a requirements sign-off process at a bank.
A product team has drafted requirements for a new AI feature. Before the requirements are locked as the
single source of truth for delivery teams and AI agents, you check them against the bank's already-locked policy.

Check each requirement for:
- conflict: it contradicts or would lead to breaching a locked policy statement. Always severity "blocker".
- ambiguity: two teams could reasonably build different things from it. "blocker" only if one reading breaches policy, otherwise "minor".
- gap: the locked policy requires something that no requirement covers. Use requirementId "general". Usually "minor".
- risk: any other material delivery, customer or compliance risk. "minor" unless serious.

Be precise and conservative: only report genuine issues, quote the policy id (e.g. "P1") you rely on, and do not
invent facts about the bank. If the requirements are sound, say so and return no issues.

Respond with a single JSON object and nothing else:
{"decision":"APPROVE"|"REJECT","summary":"one or two sentences","issues":[{"requirementId":"R1","type":"conflict"|"ambiguity"|"gap"|"risk","severity":"blocker"|"minor","detail":"...","policyRef":"P1"}]}
The decision must be "REJECT" if any issue has severity "blocker", otherwise "APPROVE".`;

export function reviewUser(policy: KnowledgeClaim[], requirements: KnowledgeClaim[], title: string): string {
  return `LOCKED POLICY (already agreed, cannot change here):
${list(policy)}

DRAFT REQUIREMENTS: ${title}
${list(requirements)}`;
}

export const ASK_SYSTEM = `You are an AI agent working on a bank's complaints assistant. You may only act on knowledge that has been
locked and signed off. Answer the question using ONLY the locked requirements and locked policy provided.
Cite the ids you rely on (e.g. "R4", "P1"). If the locked records do not answer the question, say clearly that it
is not covered and that a change would need to go through review; do not guess or fill gaps.

Respond with a single JSON object and nothing else:
{"answer":"plain-English answer in at most 4 sentences","citations":["R4","P3"],"covered":true|false}`;

export function askUser(policy: KnowledgeClaim[], requirements: KnowledgeClaim[], lockId: string, question: string): string {
  return `LOCKED REQUIREMENTS (lock ${lockId.slice(0, 12)}):
${list(requirements)}

LOCKED POLICY:
${list(policy)}

QUESTION: ${question}`;
}

export const DRIFT_SYSTEM = `You check downstream work (tickets, specs, user stories) against locked, signed-off requirements and policy
at a bank. Find every place where the work departs from what was agreed, and anything it introduces that the locked
records do not cover. Only report genuine departures, and quote the exact words from the work item.

Respond with a single JSON object and nothing else:
{"summary":"one sentence","findings":[{"requirementId":"R1","kind":"departs"|"not_covered","excerpt":"exact words from the work item","detail":"what was agreed and how this differs"}]}
Use requirementId "none" for work the locked records do not cover. Return an empty findings array if the work matches.`;

export function driftUser(policy: KnowledgeClaim[], requirements: KnowledgeClaim[], work: string): string {
  return `LOCKED REQUIREMENTS:
${list(requirements)}

LOCKED POLICY:
${list(policy)}

WORK ITEM TO CHECK:
${work}`;
}
