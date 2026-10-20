import { NextRequest, NextResponse } from "next/server";
import { KnowledgePayload, ConsensusPolicy, Attestation } from "@/lib/protocol/types";

interface AuditRequestBody {
  payload: KnowledgePayload;
  policy?: ConsensusPolicy;
  stakeholder?: {
    name: string;
    title: string;
    role: string;
  };
  apiKeys?: {
    gemini?: string;
    anthropic?: string;
    openai?: string;
  };
  mode?: "live" | "simulated";
}

// Fallback rule-based analysis for simulated generation or missing keys
function generateSimulatedModelAttestation(
  provider: "google" | "anthropic" | "openai",
  payload: KnowledgePayload,
  stakeholderTitle: string
): Attestation {
  const combinedText = payload.claims.map((c) => c.statement).join(" ").toLowerCase();
  const titleText = (payload.title || "").toLowerCase();

  const isSecScenario = titleText.includes("sec form 10-k") || combinedText.includes("article 6 of the eu ai act");
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
  const hasHighRisk = isSecScenario || highRiskTriggers.some((t) => combinedText.includes(t));

  if (provider === "google") {
    if (hasHighRisk) {
      return {
        attestationId: `att-gemini-${Date.now()}`,
        attestorType: "model",
        attestorId: "gemini-2.5-pro",
        provider: "google",
        role: "financial_and_factual_auditor",
        timestamp: Date.now(),
        decision: "REJECT",
        metrics: {
          factuality: 0.21,
          logicalConsistency: 0.32,
          citationValidity: 0.08,
          hallucinationRisk: 0.91,
        },
        reasoning:
          "Statutory & factual contradiction detected. Statement asserts regulatory exemption or absolute guarantee unsupported by governing legal authorities and audit records.",
        isLive: false,
      };
    }

    return {
      attestationId: `att-gemini-${Date.now()}`,
      attestorType: "model",
      attestorId: "gemini-2.5-pro",
      provider: "google",
      role: "financial_and_factual_auditor",
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: {
        factuality: 0.99,
        logicalConsistency: 0.98,
        citationValidity: 0.99,
        hallucinationRisk: 0.01,
      },
      reasoning: `Numerical schedules, formulas, and covenants in "${payload.title}" reconcile accurately against evidentiary documentation with zero arithmetic drift.`,
      isLive: false,
    };
  }

  if (provider === "anthropic") {
    if (hasHighRisk) {
      return {
        attestationId: `att-claude-${Date.now()}`,
        attestorType: "model",
        attestorId: "claude-3-7-sonnet",
        provider: "anthropic",
        role: "legal_and_governance_critic",
        timestamp: Date.now(),
        decision: "REJECT",
        metrics: {
          factuality: 0.17,
          logicalConsistency: 0.26,
          citationValidity: 0.05,
          hallucinationRisk: 0.94,
        },
        reasoning:
          "CRITICAL REGULATORY VIOLATION: Statement attempts to circumvent mandatory statutory compliance standards. Introduces severe corporate liability and unenforceable covenant terms.",
        isLive: false,
      };
    }

    return {
      attestationId: `att-claude-${Date.now()}`,
      attestorType: "model",
      attestorId: "claude-3-7-sonnet",
      provider: "anthropic",
      role: "legal_and_governance_critic",
      timestamp: Date.now(),
      decision: "APPROVE",
      metrics: {
        factuality: 0.98,
        logicalConsistency: 0.99,
        citationValidity: 0.98,
        hallucinationRisk: 0.01,
      },
      reasoning: `Covenants, legal warranties, and risk allocations align with standard corporate governance and statutory requirements for ${stakeholderTitle}.`,
      isLive: false,
    };
  }

  // OpenAI
  if (hasHighRisk) {
    return {
      attestationId: `att-gpt-${Date.now()}`,
      attestorType: "model",
      attestorId: "gpt-4o",
      provider: "openai",
      role: "commercial_risk_auditor",
      timestamp: Date.now(),
      decision: "REJECT",
      metrics: {
        factuality: 0.22,
        logicalConsistency: 0.34,
        citationValidity: 0.12,
        hallucinationRisk: 0.88,
      },
      reasoning:
        "Disproportionate commercial risk. The identified claim fails institutional counterparty due diligence and creates unacceptable exposure.",
      isLive: false,
    };
  }

  return {
    attestationId: `att-gpt-${Date.now()}`,
    attestorType: "model",
    attestorId: "gpt-4o",
    provider: "openai",
    role: "commercial_risk_auditor",
    timestamp: Date.now(),
    decision: "APPROVE",
    metrics: {
      factuality: 0.97,
      logicalConsistency: 0.97,
      citationValidity: 0.97,
      hallucinationRisk: 0.02,
    },
    reasoning:
      "Commercial terms and liability caps conform to prevailing institutional market benchmarks with acceptable counterparty exposure.",
    isLive: false,
  };
}

// 1. Google Gemini Live API Caller
async function callGeminiLive(
  apiKey: string,
  payload: KnowledgePayload,
  stakeholderTitle: string
): Promise<Attestation> {
  const prompt = `You are an elite enterprise financial and factual integrity auditor reviewing a high-stakes business proposal.

Matter Title: ${payload.title}
Domain: ${payload.domain}
Executive Summary: ${payload.summary || "N/A"}
Designated Executive Signer: ${stakeholderTitle}

Business Claims to Audit:
${payload.claims
  .map(
    (c, i) =>
      `Claim #${i + 1}: "${c.statement}" (Citations: ${
        c.citations?.join(", ") || "None"
      })`
  )
  .join("\n")}

AUDIT CRITERIA:
1. Verify if the claims are factually plausible, mathematically sound, and substantiated.
2. Flag any hallucinations, impossible promises (e.g. "100% guarantee", "exempt from high-risk AI laws"), or contradictory figures.
3. If hazardous or false, DECISION must be "REJECT", with hallucinationRisk > 0.80 and low factuality.
4. If valid, DECISION must be "APPROVE" with high factuality (>0.90) and low hallucinationRisk (<0.05).

Respond in STRICT JSON format with this exact schema:
{
  "decision": "APPROVE" | "REJECT",
  "metrics": {
    "factuality": number between 0.0 and 1.0,
    "logicalConsistency": number between 0.0 and 1.0,
    "citationValidity": number between 0.0 and 1.0,
    "hallucinationRisk": number between 0.0 and 1.0
  },
  "reasoning": "2-3 concise sentences detailing your specific audit findings."
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini API");

  const parsed = JSON.parse(text);
  return {
    attestationId: `att-gemini-live-${Date.now()}`,
    attestorType: "model",
    attestorId: "gemini-2.5-flash",
    provider: "google",
    role: "financial_and_factual_auditor",
    timestamp: Date.now(),
    decision: parsed.decision === "APPROVE" ? "APPROVE" : "REJECT",
    metrics: {
      factuality: Number(parsed.metrics?.factuality ?? 0.95),
      logicalConsistency: Number(parsed.metrics?.logicalConsistency ?? 0.95),
      citationValidity: Number(parsed.metrics?.citationValidity ?? 0.95),
      hallucinationRisk: Number(parsed.metrics?.hallucinationRisk ?? 0.03),
    },
    reasoning: parsed.reasoning || "Factual review completed via Gemini API.",
    isLive: true,
  };
}

// 2. Anthropic Claude Live API Caller
async function callClaudeLive(
  apiKey: string,
  payload: KnowledgePayload,
  stakeholderTitle: string
): Promise<Attestation> {
  const prompt = `Audit the following business claims for corporate legal enforceability, statutory compliance, and governance risks.

Title: ${payload.title}
Domain: ${payload.domain}
Executive Signer: ${stakeholderTitle}

Claims:
${payload.claims
  .map(
    (c, i) =>
      `${i + 1}. "${c.statement}" [Sources: ${c.citations?.join(", ") || "None"}]`
  )
  .join("\n")}

Respond ONLY with valid JSON matching:
{
  "decision": "APPROVE" or "REJECT",
  "metrics": {
    "factuality": number (0.0-1.0),
    "logicalConsistency": number (0.0-1.0),
    "citationValidity": number (0.0-1.0),
    "hallucinationRisk": number (0.0-1.0)
  },
  "reasoning": "Clear legal and governance audit finding."
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 800,
      system:
        "You are an enterprise general counsel and legal governance critic. You reject any claims with statutory violations, false regulatory exemptions, or unconscionable guarantees. Output strict JSON only.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude API");

  // Extract JSON if wrapped in markdown blocks
  const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleanJson);

  return {
    attestationId: `att-claude-live-${Date.now()}`,
    attestorType: "model",
    attestorId: "claude-3-5-sonnet",
    provider: "anthropic",
    role: "legal_and_governance_critic",
    timestamp: Date.now(),
    decision: parsed.decision === "APPROVE" ? "APPROVE" : "REJECT",
    metrics: {
      factuality: Number(parsed.metrics?.factuality ?? 0.95),
      logicalConsistency: Number(parsed.metrics?.logicalConsistency ?? 0.95),
      citationValidity: Number(parsed.metrics?.citationValidity ?? 0.95),
      hallucinationRisk: Number(parsed.metrics?.hallucinationRisk ?? 0.03),
    },
    reasoning: parsed.reasoning || "Legal review completed via Claude API.",
    isLive: true,
  };
}

// 3. OpenAI GPT Live API Caller
async function callOpenAILive(
  apiKey: string,
  payload: KnowledgePayload,
  stakeholderTitle: string
): Promise<Attestation> {
  const prompt = `Audit the following enterprise claims for commercial counterparty risk, market alignment, and operational viability:

Title: ${payload.title}
Domain: ${payload.domain}
Executive Signer: ${stakeholderTitle}

Claims:
${payload.claims
  .map(
    (c, i) =>
      `${i + 1}. "${c.statement}" (Evidence: ${c.citations?.join(", ") || "None"})`
  )
  .join("\n")}

Respond in strict JSON with keys: decision ("APPROVE" | "REJECT"), metrics (factuality, logicalConsistency, citationValidity, hallucinationRisk as 0.0-1.0 floats), reasoning (string).`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You are an enterprise commercial risk auditor. Audit counterparty risk and operational covenants. Reject disproportionate or hazardous promises. Return JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI API");

  const parsed = JSON.parse(text);

  return {
    attestationId: `att-gpt-live-${Date.now()}`,
    attestorType: "model",
    attestorId: "gpt-4o",
    provider: "openai",
    role: "commercial_risk_auditor",
    timestamp: Date.now(),
    decision: parsed.decision === "APPROVE" ? "APPROVE" : "REJECT",
    metrics: {
      factuality: Number(parsed.metrics?.factuality ?? 0.95),
      logicalConsistency: Number(parsed.metrics?.logicalConsistency ?? 0.95),
      citationValidity: Number(parsed.metrics?.citationValidity ?? 0.95),
      hallucinationRisk: Number(parsed.metrics?.hallucinationRisk ?? 0.03),
    },
    reasoning: parsed.reasoning || "Commercial review completed via OpenAI API.",
    isLive: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: AuditRequestBody = await req.json();
    const { payload, stakeholder, apiKeys = {}, mode = "live" } = body;

    if (!payload || !payload.claims || payload.claims.length === 0) {
      return NextResponse.json(
        { error: "Payload with at least one verifiable claim is required." },
        { status: 400 }
      );
    }

    const stakeholderTitle = stakeholder?.title || "Executive Signer";

    // Resolve API keys (body parameter or server process.env)
    const geminiKey = apiKeys.gemini || process.env.GEMINI_API_KEY || "";
    const anthropicKey = apiKeys.anthropic || process.env.ANTHROPIC_API_KEY || "";
    const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY || "";

    const isSimulatedOnly = mode === "simulated";

    // Run 3 providers concurrently with graceful fallback
    const [geminiResult, claudeResult, gptResult] = await Promise.all([
      // Gemini
      (async () => {
        if (!isSimulatedOnly && geminiKey) {
          try {
            return await callGeminiLive(geminiKey, payload, stakeholderTitle);
          } catch (err: unknown) {
            console.warn("Gemini live API failed, falling back to simulated:", err);
          }
        }
        return generateSimulatedModelAttestation("google", payload, stakeholderTitle);
      })(),

      // Claude
      (async () => {
        if (!isSimulatedOnly && anthropicKey) {
          try {
            return await callClaudeLive(anthropicKey, payload, stakeholderTitle);
          } catch (err: unknown) {
            console.warn("Claude live API failed, falling back to simulated:", err);
          }
        }
        return generateSimulatedModelAttestation("anthropic", payload, stakeholderTitle);
      })(),

      // OpenAI
      (async () => {
        if (!isSimulatedOnly && openaiKey) {
          try {
            return await callOpenAILive(openaiKey, payload, stakeholderTitle);
          } catch (err: unknown) {
            console.warn("OpenAI live API failed, falling back to simulated:", err);
          }
        }
        return generateSimulatedModelAttestation("openai", payload, stakeholderTitle);
      })(),
    ]);

    const attestations: Attestation[] = [geminiResult, claudeResult, gptResult];
    const liveCount = attestations.filter((a) => a.isLive).length;
    const simulatedCount = attestations.length - liveCount;

    return NextResponse.json({
      success: true,
      attestations,
      executionSummary: {
        mode,
        liveCount,
        simulatedCount,
        hasLiveGemini: Boolean(geminiResult.isLive),
        hasLiveClaude: Boolean(claudeResult.isLive),
        hasLiveOpenAI: Boolean(gptResult.isLive),
      },
    });
  } catch (error: unknown) {
    console.error("Audit route error:", error);
    const msg = error instanceof Error ? error.message : "Internal audit error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
