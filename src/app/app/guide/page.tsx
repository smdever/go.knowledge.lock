import Link from "next/link";
import { getContext } from "@/lib/app/context";
import { ROLE_HELP, ROLE_LABEL, ROLES } from "@/lib/app/roles";

const SUPPORT_EMAIL = process.env.KL_SUPPORT_EMAIL || "hello@guidedorchestration.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://guidedorchestration.com";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 text-xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{children}</p>;

const SECTIONS = [
  ["what", "What it's for"],
  ["roles", "Roles"],
  ["start", "Getting started"],
  ["flow", "From draft to locked"],
  ["ai", "What the AI reviewers do"],
  ["change", "Changing a locked record"],
  ["archive", "Archiving and retiring"],
  ["use", "Using a locked record"],
  ["passkeys", "Signing with a passkey"],
  ["api", "Connecting your own AI agents"],
  ["emails", "Emails you'll get"],
  ["jira", "Jira"],
  ["slack", "Slack and Teams"],
  ["data", "Your data"],
  ["help", "Getting help"],
] as const;

export default async function GuidePage() {
  const ctx = await getContext("/app/guide");
  const owner = ctx.current?.role === "owner";
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">Guide</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">How Knowledge Lock works</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/75">A five-minute read for everyone taking part in the pilot.</p>

      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-steel hover:text-ink">{label}</a>
        ))}
      </nav>

      <H2 id="what">What it&apos;s for</H2>
      <P>
        Knowledge Lock is where your teams and AI models agree on something that matters, such as requirements for an AI feature or
        a policy interpretation, and then lock the agreed wording. Everyone, and every AI agent, then works from exactly that version.
        Nobody can quietly change it, and anyone can check who agreed it and when.
      </P>

      <H2 id="roles">Roles</H2>
      <dl className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
        {ROLES.map((r) => (
          <div key={r} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="w-20 shrink-0 font-semibold">{ROLE_LABEL[r]}</dt>
            <dd className="text-[15px] text-ink/80">Can {ROLE_HELP[r]}.</dd>
          </div>
        ))}
      </dl>

      <H2 id="start">Getting started</H2>
      {owner ? (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
          <li>
            <Link href="/app/team" className="font-semibold text-steel hover:text-ink">Invite your team</Link>. Make the people who
            need to agree things signers, and everyone who only needs to read them viewers.
          </li>
          <li>
            <Link href="/app/policies" className="font-semibold text-steel hover:text-ink">Propose your policy</Link>: the rules
            every record must follow. It goes through review and sign-off like anything else. You can skip this, but then the AI
            reviewers only check for contradictions and unclear wording.
          </li>
          <li>
            Create your first <Link href="/app/records/new" className="font-semibold text-steel hover:text-ink">record</Link>.
            Pick something real but small: five to ten statements that several teams need to agree. Templates give you example
            wording to edit, and you can lock it on your own to see the whole flow.
          </li>
        </ol>
      ) : null}
      {owner ? (
        <P>
          Until your organisation locks its first record, owners see a <strong>Get started</strong> list on the home page that ticks
          itself off as you go. If nothing is locked a few days after you join, we send one reminder email.
        </P>
      ) : (
        <P>
          Your organisation&apos;s owner sets things up. As a signer you&apos;ll get an email when your sign-off is needed. You can
          also create records yourself from the home page.
        </P>
      )}

      <H2 id="flow">From draft to locked</H2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>
          <strong>Write it.</strong> A title and one statement per line. Short, separate statements are easier to review and sign
          off. You choose who signs it off, and how many of them must approve.
        </li>
        <li>
          <strong>AI review.</strong> Three AI models from different providers check every line, independently.
        </li>
        <li>
          <strong>Fix objections.</strong> If a reviewer objects, you can ask it for a suggested fix, edit the line yourself, or
          remove it. Any change sends the whole record back for review.
        </li>
        <li>
          <strong>Sign off.</strong> Each chosen person approves or asks for changes, from their own account. Nobody can sign for
          someone else. Changing the wording clears everyone&apos;s sign-off, because they agreed to the old words.
        </li>
        <li>
          <strong>Lock.</strong> Once enough people have approved, and nobody has an open objection, any owner or signer can lock it.
        </li>
      </ol>
      <div className="mt-4 rounded-xl border border-ink/10 p-4 text-[15px] leading-relaxed text-ink/80">
        <p className="font-semibold text-ink">How the quorum works</p>
        <p className="mt-1">
          &ldquo;2 of 3&rdquo; means any two of the three named people can approve it. That covers someone being away. It
          doesn&apos;t outvote disagreement: if anyone asks for changes, the record can&apos;t be locked until they approve or the
          wording changes.
        </p>
      </div>

      <H2 id="ai">What the AI reviewers do</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>They check each line against your locked policy and flag conflicts, ambiguity, gaps and risks.</li>
        <li>A conflict with the policy blocks the lock. Minor notes are shown but don&apos;t block anything.</li>
        <li>Suggested fixes are only used if you accept them, and every accepted fix is recorded in the locked record.</li>
        <li>
          They can be wrong. They help people spot problems; people still decide. If a reviewer objects to something you&apos;re
          sure is fine, rewording it to be clearer usually resolves it.
        </li>
      </ul>

      <H2 id="change">Changing a locked record</H2>
      <P>
        Locked records are never edited. Open the record, choose <strong>Propose a change</strong>, and a new version starts with
        the same wording and the same signers. It goes back through review and sign-off. When it&apos;s locked, it replaces the old
        version, which stays visible and is marked as replaced.
      </P>

      <H2 id="archive">Archiving and retiring</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>
          <strong>Archive a draft</strong> you no longer need. Its creator or an owner can archive it from the top of the draft. It moves
          to <strong>Archived</strong> on the home page, and nothing can be reviewed, signed or locked until it&apos;s restored.
        </li>
        <li>
          <strong>Retire a locked record</strong> that&apos;s no longer the source of truth. Only owners can, from{" "}
          <strong>Build from it</strong>, and they give a reason. The lock never changes and still verifies, but the agent, Jira checks
          and the API stop using it, and everyone who opens it sees who retired it, when and why. Retiring covers every version of the
          record. Any draft of a next version is archived with it.
        </li>
        <li>The policy can&apos;t be retired. Propose a new version of it instead.</li>
        <li>An owner can restore a retired record, and it&apos;s the signed-off version again.</li>
      </ul>

      <H2 id="use">Using a locked record</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>
          <strong>Verify it.</strong> Checks in your browser that the record hasn&apos;t changed since it was locked. Change a single
          word in a copy and the check fails.
        </li>
        <li>
          <strong>Ask the agent.</strong> Answers questions using only the locked record and your policy, and says when something
          isn&apos;t covered.
        </li>
        <li>
          <strong>Check a ticket.</strong> Paste a ticket, user story or spec to see where it departs from what was agreed.
        </li>
      </ul>

      <H2 id="passkeys">Signing with a passkey</H2>
      <P>
        Set up a passkey on your <strong>Profile</strong> page and every sign-off you give is signed on your own device, with Touch
        ID, Face ID, Windows Hello, your phone or a security key. The signature covers the exact wording, your decision and any
        comment, and it goes into the lock. Anyone checking the lock can then confirm it was you, without having to trust us.
      </P>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>Once you have a passkey, you always sign with it.</li>
        <li>An owner can make passkeys required under <strong>Team</strong>. Records started after that only accept signed sign-offs.</li>
        <li>You&apos;ll get an email whenever a passkey is added to or removed from your account.</li>
        <li>Removing a passkey withdraws the sign-offs it made on records that aren&apos;t locked yet, so you&apos;d sign those again.</li>
      </ul>

      <H2 id="api">Connecting your own AI agents</H2>
      <P>
        Owners can create API keys under <strong>API</strong>. Your own systems and AI agents can then read your locked records,
        check they haven&apos;t changed, ask questions of them and check work against them. The API can&apos;t change or sign
        anything. See the{" "}
        <a href={`${SITE_URL}/docs/knowledge-lock-api`} className="text-steel underline hover:text-ink">
          API documentation
        </a>
        .
      </P>

      <H2 id="emails">Emails you&apos;ll get</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>A sign-in link each time you sign in. There are no passwords.</li>
        <li>When your sign-off is needed, once the AI reviewers have approved the wording.</li>
        <li>When someone asks for changes to a record you created or are signing.</li>
        <li>When a record you&apos;re involved in is locked, retired or restored.</li>
      </ul>

      <H2 id="jira">Jira</H2>
      <P>
        An owner connects Jira under <strong>Integrations</strong>, with a Jira account&apos;s email and API token. Then, on any locked
        record, open <strong>Build from it</strong> to:
      </P>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>
          <strong>Check an issue.</strong> Enter its key, like CLM-42. Knowledge Lock reads the issue, checks it against the record and
          posts the findings as a comment on the issue. The issue is then linked, and gets a &ldquo;Knowledge Lock&rdquo; web link in Jira.
        </li>
        <li>
          <strong>Create issues.</strong> One Jira issue per requirement, in the project you choose, each linked back to the record.
        </li>
        <li>
          <strong>Automatic checks.</strong> Once the owner adds the webhook in Jira, linked issues are re-checked when their summary or
          description changes. A comment is only added when the result changes.
        </li>
        <li>When a new version of the record is locked, its linked issues move to the new version and are checked against it.</li>
        <li>When the record is retired, its linked issues get a comment saying so, and they&apos;re no longer checked against it.</li>
      </ul>

      <H2 id="slack">Slack and Teams</H2>
      <P>
        Owners can connect Slack or Microsoft Teams channels under <strong>Integrations</strong>. Knowledge Lock then posts there
        when a sign-off is needed, when someone asks for changes, when something is locked, and when a record is retired, with a button back to the record.
        In Teams you&apos;re @mentioned by your work email. In Slack, add your Slack member ID on your <strong>Profile</strong> page to
        be @mentioned.
      </P>

      <H2 id="data">Your data</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
        <li>Your organisation&apos;s records are only visible to its members.</li>
        <li>The text of a record is sent to Anthropic, OpenAI and Google so their models can review it.</li>
        <li>
          During the pilot, please don&apos;t enter customers&apos; personal data, health or other sensitive personal information,
          passwords or secrets.
        </li>
        <li>Locked records and the activity log can&apos;t be edited. At the end of the pilot we can delete your organisation&apos;s data on request.</li>
        <li>
          See the <a href={`${SITE_URL}/privacy`} className="text-steel underline hover:text-ink">privacy notice</a> and{" "}
          <a href={`${SITE_URL}/terms`} className="text-steel underline hover:text-ink">terms</a>.
        </li>
      </ul>

      <H2 id="help">Getting help</H2>
      <P>
        Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-steel hover:text-ink">{SUPPORT_EMAIL}</a>. Feedback
        is the point of the pilot, so tell us anything that&apos;s confusing, slow or missing.
      </P>
    </div>
  );
}
