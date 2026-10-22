import { ProfileForm } from "@/components/app/forms";
import { saveProfileAction } from "@/app/app/actions";
import { getContext } from "@/lib/app/context";

export default async function ProfilePage() {
  const ctx = await getContext("/app/profile");
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-ink/65">Signed in as {ctx.user.email}</p>
      <div className="mt-8">
        <ProfileForm action={saveProfileAction} name={ctx.profile?.name} title={ctx.profile?.title} submit="Save" />
      </div>
    </div>
  );
}
