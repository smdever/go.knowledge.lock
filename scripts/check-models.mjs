// Sends a tiny request to each configured provider to confirm the key and model ID work.
// Run: node --env-file=.env.local scripts/check-models.mjs
const checks = [
  {
    name: "Anthropic",
    key: process.env.ANTHROPIC_API_KEY,
    model: process.env.KL_ANTHROPIC_MODEL || "claude-sonnet-5-5",
    run: (key, model) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 20, messages: [{ role: "user", content: 'Reply with {"ok":true}' }] }),
      }),
  },
  {
    name: "OpenAI",
    key: process.env.OPENAI_API_KEY,
    model: process.env.KL_OPENAI_MODEL || "gpt-5.6-terra",
    run: (key, model) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: 200,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: 'Reply with the JSON {"ok":true}' }],
        }),
      }),
  },
  {
    name: "Google",
    key: process.env.GEMINI_API_KEY,
    model: process.env.KL_GOOGLE_MODEL || "gemini-3.5-flash",
    run: (key, model) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: 'Reply with {"ok":true}' }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 200 },
        }),
      }),
  },
];

for (const c of checks) {
  if (!c.key) {
    console.log(`- ${c.name}: no API key set, skipped`);
    continue;
  }
  try {
    const res = await c.run(c.key, c.model);
    const body = await res.text();
    console.log(res.ok ? `✓ ${c.name} (${c.model}) OK` : `✗ ${c.name} (${c.model}) ${res.status}: ${body.slice(0, 200)}`);
  } catch (err) {
    console.log(`✗ ${c.name} (${c.model}) ${err.message}`);
  }
}
