import type { ProviderId } from "../types";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  model: string;
  apiKey?: string;
}

/** Model IDs can be changed without code changes via the KL_*_MODEL variables. */
export function providerConfigs(): ProviderConfig[] {
  return [
    {
      id: "anthropic",
      label: "Anthropic",
      model: process.env.KL_ANTHROPIC_MODEL || "claude-sonnet-5-5",
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    {
      id: "openai",
      label: "OpenAI",
      model: process.env.KL_OPENAI_MODEL || "gpt-5.6-terra",
      apiKey: process.env.OPENAI_API_KEY,
    },
    {
      id: "google",
      label: "Google",
      model: process.env.KL_GOOGLE_MODEL || "gemini-3.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
    },
  ];
}

/** Local-only deterministic stub for testing the flow without API keys. Never active in production. */
export function stubEnabled(): boolean {
  return process.env.KL_FAKE_MODELS === "1" && process.env.NODE_ENV !== "production";
}

export function isConfigured(p: ProviderConfig): boolean {
  return Boolean(p.apiKey) || stubEnabled();
}
