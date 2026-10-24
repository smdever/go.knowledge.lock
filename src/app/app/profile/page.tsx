import { AddPasskeyButton, ProfileForm, SlackIdForm } from "@/components/app/forms";
import { removePasskeyAction, saveProfileAction, saveSlackIdAction } from "@/app/app/actions";
import { appDb } from "@/lib/app/db";
import { getContext } from "@/lib/app/context";
import { listPasskeys } from "@/lib/app/passkeys";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(d);

export default async function ProfilePage() {
  const ctx = await getContext("/app/profile");
  const passkeys = await listPasskeys(ctx.user.id);
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
    </div>
  );
}
