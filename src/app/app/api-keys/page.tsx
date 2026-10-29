import { notFound } from "next/navigation";
import { ApiKeyForm } from "@/components/app/forms";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/app/actions";
import { listApiKeys } from "@/lib/app/apikeys";
import { getContext } from "@/lib/app/context";
import { appUrl } from "@/lib/mode";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";
const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d) : "Never";

const pre = "mt-2 overflow-x-auto rounded-lg border border-ink/15 bg-surface p-3 font-mono text-xs leading-relaxed";

export default async function ApiKeysPage() {
  const ctx = await getContext("/app/api-keys");
  if (!ctx.current || ctx.current.role !== "owner") notFound();
  const keys = await listApiKeys(ctx.current.orgId);
  const mcpUrl = `${appUrl()}/api/mcp`;
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">{ctx.current.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">API keys</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        Let your own systems and AI agents read {ctx.current.orgName}&apos;s locked records, ask questions of them and check work
        against them. Keys can read and check, but can&apos;t change anything.{" "}
        <a href={`${SITE_URL}/docs/knowledge-lock-api`} className="text-steel underline hover:text-ink">How to use the API</a>
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Create a key</h2>
        <p className="mt-1 text-sm text-ink/70">Use one key per agent or system, so you can revoke one without affecting the others.</p>
        <div className="mt-4">
          <ApiKeyForm action={createApiKeyAction} />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="mcp-title">
        <h2 id="mcp-title" className="text-lg font-semibold">Connect an AI agent (MCP)</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          AI tools that support the Model Context Protocol (MCP), such as Claude Code, Cursor and VS Code, can connect to Knowledge Lock
          directly. Your agent can then list locked records, read them, ask questions answered only from them, and check its work against
          them before it finishes. It can&apos;t change anything. Connect with a key from this page, sent as an Authorization header.
        </p>
        <p className="mt-3 text-sm">
          Server address: <code className="font-mono text-xs">{mcpUrl}</code>
        </p>
        <h3 className="mt-5 text-sm font-semibold">Claude Code</h3>
        <p className="mt-1 text-sm text-ink/70">Run this in your project, with your key in place of kl_live_…</p>
        <pre tabIndex={0} className={pre}><code>{`claude mcp add --transport http knowledge-lock ${mcpUrl} \\
  --header "Authorization: Bearer kl_live_…"`}</code></pre>
        <h3 className="mt-5 text-sm font-semibold">Cursor</h3>
        <p className="mt-1 text-sm text-ink/70">
          Add this to <code className="font-mono text-xs">.cursor/mcp.json</code> in your project, or <code className="font-mono text-xs">~/.cursor/mcp.json</code> for every project.
        </p>
        <pre tabIndex={0} className={pre}><code>{JSON.stringify({ mcpServers: { "knowledge-lock": { url: mcpUrl, headers: { Authorization: "Bearer kl_live_…" } } } }, null, 2)}</code></pre>
        <h3 className="mt-5 text-sm font-semibold">VS Code</h3>
        <p className="mt-1 text-sm text-ink/70">
          Add this to <code className="font-mono text-xs">.vscode/mcp.json</code>. VS Code asks for the key the first time and keeps it out of the file.
        </p>
        <pre tabIndex={0} className={pre}><code>{JSON.stringify(
          {
            inputs: [{ type: "promptString", id: "kl-key", description: "Knowledge Lock API key", password: true }],
            servers: { "knowledge-lock": { type: "http", url: mcpUrl, headers: { Authorization: "Bearer ${input:kl-key}" } } },
          },
          null,
          2
        )}</code></pre>
        <p className="mt-3 text-sm text-ink/70">
          Treat the key like a password: don&apos;t commit a file that contains it. Requests count towards the key&apos;s limits, and questions
          and checks appear in the activity log. The text your agent checks isn&apos;t kept.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Active keys ({keys.length})</h2>
        {keys.length ? (
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{k.name}</p>
                  <p className="text-sm text-ink/70">
                    <code className="font-mono text-xs">{k.prefix}…</code> · created {fmt(k.createdAt)}
                    {k.createdByName ? ` by ${k.createdByName}` : ""} · last used {fmt(k.lastUsedAt)}
                  </p>
                </div>
                <form action={revokeApiKeyAction}>
                  <input type="hidden" name="keyId" value={k.id} />
                  <button type="submit" className="text-sm text-muted hover:text-bad">Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink/70">No keys yet.</p>
        )}
      </section>
    </div>
  );
}
