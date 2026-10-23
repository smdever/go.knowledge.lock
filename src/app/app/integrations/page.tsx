import { notFound } from "next/navigation";
import { AddChannelForm, TestChannelButton } from "@/components/app/forms";
import { addChannelAction, removeChannelAction, testChannelAction } from "@/app/app/actions";
import { EVENT_LABEL, listChannels } from "@/lib/app/channels";
import { getContext } from "@/lib/app/context";

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

export default async function IntegrationsPage() {
  const ctx = await getContext("/app/integrations");
  if (!ctx.current || ctx.current.role !== "owner") notFound();
  const channels = await listChannels(ctx.current.orgId);
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">{ctx.current.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Slack and Teams</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        Post notices to your team&apos;s channels when a sign-off is needed, changes are requested, or something is locked. Each
        notice has a button back to the record. Emails still go out as usual. Notices include record titles and comments, so
        choose channels that only the right people can see.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Connected channels ({channels.length})</h2>
        {channels.length ? (
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {channels.map((c) => (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {c.name} <span className="ml-1 text-sm font-normal text-muted">{c.kind === "slack" ? "Slack" : "Teams"}</span>
                    </p>
                    <p className="text-sm text-ink/60">
                      <code className="font-mono text-xs">{c.hint}</code> · {c.events.map((e) => EVENT_LABEL[e]).join(", ")}
                    </p>
                    <p className={`mt-1 text-sm ${c.paused || c.lastError ? "text-bad" : "text-ink/60"}`}>
                      {c.paused
                        ? `Paused after ${c.failures} failed posts: ${c.lastError} Send a test to start it again.`
                        : c.lastError
                          ? `Last post failed: ${c.lastError}`
                          : c.lastOkAt
                            ? `Working. Last posted ${fmt(c.lastOkAt)}.`
                            : "Nothing posted yet."}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <TestChannelButton action={testChannelAction} id={c.id} />
                    <form action={removeChannelAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-sm text-muted hover:text-bad">Remove</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink/60">None yet.</p>
        )}
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="text-lg font-semibold">Connect a channel</h2>
        <div className="mt-4">
          <AddChannelForm action={addChannelAction} />
        </div>
      </section>

      <section className="mt-10 max-w-2xl text-sm text-ink/70">
        <h2 className="text-lg font-semibold text-ink">Mentions</h2>
        <p className="mt-2">
          In Teams, people who need to act are @mentioned by their work email, which works when it matches their Teams sign-in. In
          Slack, ask people to add their Slack member ID on their Profile page; until they do, their name is shown in bold instead.
        </p>
      </section>
    </div>
  );
}
