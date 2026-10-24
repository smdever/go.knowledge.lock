import { Download } from "lucide-react";
import { AddPasskeyButton, DeleteAccountForm, LeaveOrgForm, ProfileForm, SlackIdForm } from "@/components/app/forms";
import { deleteAccountAction, leaveOrgAction, removePasskeyAction, saveProfileAction, saveSlackIdAction } from "@/app/app/actions";
import { soleOwnerOf } from "@/lib/app/account";
import { ROLE_LABEL } from "@/lib/app/roles";
import { appDb } from "@/lib/app/db";
import { getContext } from "@/lib/app/context";
import { listPasskeys } from "@/lib/app/passkeys";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(d);

export default async function ProfilePage() {
  const ctx = await getContext("/app/profile");
  const [passkeys, soleOwner] = await Promise.all([listPasskeys(ctx.user.id), soleOwnerOf(ctx.user.id)]);
  const db = await appDb();
  const [slack] = await db<{ id: string | null }[]>`SELECT slack_member_id AS id FROM kl_profiles WHERE user_id = ${ctx.user.id}`;
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-ink/70">Signed in as {ctx.user.email}</p>
      <div className="mt-8 max-w-md">
        <ProfileForm action={saveProfileAction} name={ctx.profile?.name} title={ctx.profile?.title} submit="Save" />
        <div className="mt-8">
          <SlackIdForm action={saveSlackIdAction} value={slack?.id} />
        </div>
      </div>

      <section className="mt-12" id="passkeys">
        <h2 className="text-lg font-semibold">Your signing key</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          With a passkey, each sign-off you give is signed on your own device with Touch ID, Face ID, Windows Hello, your phone or a
          security key. The signature goes into the lock, so anyone can check it was you, even without trusting us. We only keep
          the public half of the key.
        </p>
        {passkeys.length ? (
          <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {passkeys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{k.name}</p>
                  <p className="text-sm text-ink/70">
                    Added {fmt(k.createdAt)} · {k.lastUsedAt ? `last used ${fmt(k.lastUsedAt)}` : "not used yet"}
                    {k.synced ? " · available on your other devices" : " · this device only"}
                  </p>
                </div>
                <form action={removePasskeyAction}>
                  <input type="hidden" name="id" value={k.id} />
                  <button type="submit" className="text-sm text-muted hover:text-bad">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4">
          <AddPasskeyButton first={!passkeys.length} />
        </div>
        {passkeys.length ? (
          <p className="mt-3 text-sm text-ink/70">
            Removing a passkey withdraws any sign-offs it made on records that aren&apos;t locked yet. Locked records keep their
            signatures.
          </p>
        ) : null}
      </section>

      <section className="mt-12" id="data">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          Download everything we hold about you: your profile, organisations and roles, passkeys, sign-offs, comments and
          activity. It&apos;s a JSON file you can open in any text editor.
        </p>
        <a
          href="/api/app/me/export"
          download
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold hover:border-ink/40"
        >
          <Download className="h-4 w-4" /> Download my data
        </a>
      </section>

      {ctx.memberships.length ? (
        <section className="mt-12" id="organisations">
          <h2 className="text-lg font-semibold">Your organisations</h2>
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {ctx.memberships.map((m) => (
              <li key={m.orgId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-semibold">{m.orgName}</span>
                  <span className="text-sm text-ink/70"> · {ROLE_LABEL[m.role]}{m.closing ? " · closing" : ""}</span>
                </span>
                <LeaveOrgForm action={leaveOrgAction} orgId={m.orgId} orgName={m.orgName} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink/70">
            When you leave, your sign-offs stay in records the organisation has locked, because those records belong to it.
          </p>
        </section>
      ) : null}

      <section className="mt-12" id="delete">
        <h2 className="text-lg font-semibold">Delete your account</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/70">
          You leave every organisation, and your profile, passkeys and sign-in account are deleted straight away. Records your
          organisations have locked keep your sign-offs, because those records belong to them and are what they rely on.
        </p>
        {soleOwner.length ? (
          <p className="mt-3 rounded-lg border border-warn/50 bg-surface px-3 py-2.5 text-sm text-ink/80">
            You&apos;re the only owner of {soleOwner.join(" and ")}. Make someone else an owner on the Team page, or close the
            organisation, before you delete your account.
          </p>
        ) : (
          <div className="mt-4">
            <DeleteAccountForm action={deleteAccountAction} email={ctx.user.email} />
          </div>
        )}
      </section>
    </div>
  );
}
