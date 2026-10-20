import type { ProviderId } from "../types";
import type { ModelCall } from "./call";

/**
 * LOCAL TEST STUB ONLY. Enabled with KL_FAKE_MODELS=1 outside production so the flow can be
 * exercised without API keys. Results are marked as stub output in the UI.
 */
export function stubResponse(provider: ProviderId, call: ModelCall): string {
  const text = call.user;
  if (call.task === "review") {
    const lines = text.split("\n").filter((l) => /^R\d+:/.test(l));
    const risky = lines.find((l) => /goodwill payment|without involving a case handler/i.test(l));
    if (risky) {
      const id = risky.split(":")[0];
      return JSON.stringify({
        decision: "REJECT",
        summary: `[stub ${provider}] ${id} lets the assistant grant redress without a case handler.`,
        issues: [
          {
            requirementId: id,
            type: "conflict",
            severity: "blocker",
            detail: "[stub] Offering a goodwill payment decides the outcome of a complaint, which P1 reserves for a human case handler.",
            policyRef: "P1",
          },
        ],
      });
    }
    return JSON.stringify({ decision: "APPROVE", summary: `[stub ${provider}] No conflicts with locked policy found.`, issues: [] });
  }
  if (call.task === "ask") {
    const q = text.slice(text.lastIndexOf("QUESTION:")).toLowerCase();
    if (/refund|payment|compensat/.test(q)) {
      return JSON.stringify({
        answer: "[stub] No. The assistant can collect and submit the complaint, but decisions about redress are made by a human case handler.",
        citations: ["R2", "P1"],
        covered: true,
      });
    }
    if (/job|hardship|bereave|ill/.test(q)) {
      return JSON.stringify({
        answer: "[stub] Offer an immediate handover to a colleague in the same conversation.",
        citations: ["R4", "P3"],
        covered: true,
      });
    }
    return JSON.stringify({ answer: "[stub] The locked records do not cover this.", citations: [], covered: false });
  }
  const findings = [];
  if (/skip/i.test(text)) {
    findings.push({
      requirementId: "R1",
      kind: "departs",
      excerpt: 'Skip the "you are talking to an AI assistant" message',
      detail: "[stub] R1 requires the AI disclosure at the start of every conversation.",
    });
  }
  if (/auto-close/i.test(text)) {
    findings.push({
      requirementId: "none",
      kind: "not_covered",
      excerpt: "Auto-close the complaint if the customer has not replied within 48 hours.",
      detail: "[stub] Closing a complaint is not covered by the locked requirements and P1 reserves outcomes for a case handler.",
    });
  }
  return JSON.stringify({ summary: `[stub] ${findings.length} departure(s) found.`, findings });
}
