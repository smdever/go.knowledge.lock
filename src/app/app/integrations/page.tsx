import { notFound } from "next/navigation";
import { AddChannelForm, CopyLink, JiraConnectForm, TestChannelButton, ToggleForm } from "@/components/app/forms";
import {
  addChannelAction,
  connectJiraAction,
  disconnectJiraAction,
  removeChannelAction,
  setJiraAutoCheckAction,
  testChannelAction,
} from "@/app/app/actions";
import { jiraStatus } from "@/lib/app/jira";
import { EVENT_LABEL, listChannels } from "@/lib/app/channels";
import { getContext } from "@/lib/app/context";

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

export default async function IntegrationsPage() {
  const ctx = await getContext("/app/integrations");
  if (!ctx.current || ctx.current.role !== "owner") notFound();
  const [channels, jira] = await Promise.all([listChannels(ctx.current.orgId), jiraStatus(ctx.current.orgId, true)]);
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">{ctx.current.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Integrations</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
        Connect the tools your teams already use, so what you&apos;ve locked reaches them.
      </p>

      {/* ---------------- Jira ---------------- */}
      <section className="mt-10 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6" id="jira">
        <h2 className="text-xl font-semibold">Jira</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          Check Jira issues against what was agreed, with the findings posted on the issue. Create issues from a locked record, and
          have linked issues re-checked when they change. You&apos;ll find these on each locked record, under <strong>Build from it</strong>.
        </p>
        {jira.connected ? (
          <div className="mt-5 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p>
                  <span className="font-semibold">Connected</span> to {jira.site?.replace(/^https?:\/\//, "")} as {jira.accountName} ({jira.email})
                </p>
                {jira.lastError ? <p className="mt-1 text-bad">{jira.lastError}</p> : null}
              </div>
              <form action={disconnectJiraAction}>
                <button type="submit" className="text-sm text-muted hover:text-bad">Disconnect</button>
              </form>
            </div>

            <div>
              <h3 className="font-semibold">Automatic checks</h3>
              <p className="mt-1 text-sm text-ink/70">
                In Jira, go to <strong>Settings › System › WebHooks › Create a WebHook</strong> and enter:
              </p>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold">URL</dt>
                  <dd><CopyLink link={jira.webhookUrl ?? ""} /></dd>
                </div>
                <div>
                  <dt className="font-semibold">Secret</dt>
                  <dd><CopyLink link={jira.webhookSecret ?? ""} /></dd>
                </div>
                <div>
                  <dt className="font-semibold">Events</dt>
                  <dd className="text-ink/75">Issue: <strong>created</strong> and <strong>updated</strong>. Optionally limit it with JQL, such as <code className="font-mono text-xs">project = CLM</code>.</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-ink/70">
                {jira.lastWebhookAt ? `Last heard from Jira ${fmt(jira.lastWebhookAt)}.` : "We haven't heard from Jira yet."} Only linked issues are
                checked, only when their summary or description changes, and a comment is only added when the result changes.
              </p>
              <div className="mt-4">
                <ToggleForm
                  action={setJiraAutoCheckAction}
                  name="auto"
                  on={Boolean(jira.autoCheck)}
                  label="Re-check linked issues when they change"
                  help="Each check uses one AI review from your organisation's allowance."
                />
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-steel hover:text-ink">Change the account or token</summary>
              <div className="mt-4">
                <JiraConnectForm action={connectJiraAction} site={jira.site?.replace(/^https?:\/\//, "")} email={jira.email} />
              </div>
            </details>
          </div>
        ) : (
          <div className="mt-5">
            <JiraConnectForm action={connectJiraAction} />
          </div>
        )}
      </section>

      {/* ---------------- Slack and Teams ---------------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold">Slack and Teams</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          Post notices to your team&apos;s channels when a sign-off is needed, changes are requested, or something is locked. Each
          notice has a button back to the record. Emails still go out as usual. Notices include record titles and comments, so
          choose channels that only the right people can see.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Connected channels ({channels.length})</h3>
        {channels.length ? (
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {channels.map((c) => (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {c.name} <span className="ml-1 text-sm font-normal text-muted">{c.kind === "slack" ? "Slack" : "Teams"}</span>
                    </p>
                    <p className="text-sm text-ink/70">
                      <code className="font-mono text-xs">{c.hint}</code> · {c.events.map((e) => EVENT_LABEL[e]).join(", ")}
                    </p>
                    <p className={`mt-1 text-sm ${c.paused || c.lastError ? "text-bad" : "text-ink/70"}`}>
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
          <p className="mt-3 text-sm text-ink/70">None yet.</p>
        )}
      </section>

      <section className="mt-10 max-w-xl">
        <h3 className="text-lg font-semibold">Connect a channel</h3>
        <div className="mt-4">
          <AddChannelForm action={addChannelAction} />
        </div>
      </section>

      <section className="mt-10 max-w-2xl text-sm text-ink/70">
        <h3 className="text-lg font-semibold text-ink">Mentions</h3>
        <p className="mt-2">
          In Teams, people who need to act are @mentioned by their work email, which works when it matches their Teams sign-in. In
          Slack, ask people to add their Slack member ID on their Profile page; until they do, their name is shown in bold instead.
        </p>
      </section>
    </div>
  );
}
