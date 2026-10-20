import type { ProviderConfig } from "./config";
import { stubEnabled } from "./config";
import { stubResponse } from "./stub";

export interface ModelCall {
  system: string;
  user: string;
  maxTokens?: number;
  /** Which task the call is for; only used by the local test stub. */
  task: "review" | "ask" | "drift";
}

const TIMEOUT_MS = 50_000;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let message = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || message;
      } catch {}
      throw new Error(`${res.status} ${message}`);
    }
    return JSON.parse(text);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("The model took too long to respond.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Calls a provider and returns its text output. Keys stay on the server. */
export async function callModel(provider: ProviderConfig, call: ModelCall): Promise<string> {
  if (!provider.apiKey) {
    if (stubEnabled()) return stubResponse(provider.id, call);
    throw new Error(`${provider.label} is not configured.`);
  }
  const maxTokens = call.maxTokens ?? 2000;

  if (provider.id === "anthropic") {
    const data = (await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: provider.model,
        max_tokens: maxTokens,
        system: call.system,
        messages: [{ role: "user", content: call.user }],
      }
    )) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  }

  if (provider.id === "openai") {
    const data = (await post(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${provider.apiKey}` },
      {
        model: provider.model,
        max_completion_tokens: maxTokens * 4, // reasoning models spend tokens before answering
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.user },
        ],
      }
    )) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  const data = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,
    { "x-goog-api-key": provider.apiKey },
    {
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: "user", parts: [{ text: call.user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens * 4 },
    }
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

/** Extracts the first JSON object from model output (tolerates code fences and surrounding text). */
export function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}
