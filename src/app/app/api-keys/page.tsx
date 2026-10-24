import { notFound } from "next/navigation";
import { ApiKeyForm } from "@/components/app/forms";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/app/actions";
import { listApiKeys } from "@/lib/app/apikeys";
import { getContext } from "@/lib/app/context";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";
const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d) : "Never";

export default async function ApiKeysPage() {
  const ctx = await getContext("/app/api-keys");
  if (!ctx.current || ctx.current.role !== "owner") notFound();
  const keys = await listApiKeys(ctx.current.orgId);
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
