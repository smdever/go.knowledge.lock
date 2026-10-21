/**
 * JSON Schemas for structured model output. Anthropic enforces them through structured outputs
 * (output_config.format), which requires additionalProperties: false on every object.
 */

export interface OutputSchema {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export const REVIEW_SCHEMA: OutputSchema = {
  name: "submit_review",
  description: "Submit the review of the draft requirements against the locked policy.",
  schema: {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["APPROVE", "REJECT"] },
      summary: { type: "string", description: "One or two sentences." },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirementId: { type: "string", description: 'e.g. "R3", or "general" for gaps' },
            type: { type: "string", enum: ["conflict", "ambiguity", "gap", "risk"] },
            severity: { type: "string", enum: ["blocker", "minor"] },
            detail: { type: "string" },
            policyRef: { type: "string", description: 'e.g. "P1"' },
          },
          required: ["requirementId", "type", "severity", "detail"],
          additionalProperties: false,
        },
      },
    },
    required: ["decision", "summary", "issues"],
    additionalProperties: false,
  },
};

export const ASK_SCHEMA: OutputSchema = {
  name: "submit_answer",
  description: "Submit the answer, based only on the locked records.",
  schema: {
    type: "object",
    properties: {
      answer: { type: "string" },
      citations: { type: "array", items: { type: "string" } },
      covered: { type: "boolean" },
    },
    required: ["answer", "citations", "covered"],
    additionalProperties: false,
  },
};

export const DRIFT_SCHEMA: OutputSchema = {
  name: "submit_drift_check",
  description: "Submit every departure between the work item and the locked records.",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirementId: { type: "string", description: 'e.g. "R1", or "none"' },
            kind: { type: "string", enum: ["departs", "not_covered"] },
            excerpt: { type: "string" },
            detail: { type: "string" },
          },
          required: ["requirementId", "kind", "excerpt", "detail"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "findings"],
    additionalProperties: false,
  },
};
