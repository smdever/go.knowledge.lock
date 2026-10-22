"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appUrl } from "@/lib/mode";
import { DEV_COOKIE, devAuthEnabled, devSessionValue, getUser, safeNext, supabaseConfig, supabaseServer } from "@/lib/app/auth";
import { getContext, ORG_COOKIE } from "@/lib/app/context";
import { inviteEmail, sendEmail } from "@/lib/app/email";
import {
  acceptInvite,
  AppError,
  changeRole,
  checkEmail,
  createInvite,
  createOrganisation,
  mayRequestSignIn,
  removeMember,
  revokeInvite,
  ROLE_LABEL,
  saveProfile,
  type Role,
} from "@/lib/app/orgs";

export interface FormState {
  error?: string;
  message?: string;
  link?: string;
  sentTo?: string;
}

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

/** Turns AppErrors into a message for the form; everything else (including redirects) carries on. */
async function attempt(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    throw err;
  }
}

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const YEAR = 60 * 60 * 24 * 365;

// ---------- Sign in and out ----------

export async function requestSignInLink(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const email = checkEmail(str(fd, "email"));
    const next = safeNext(str(fd, "next"));
    if (devAuthEnabled()) {
      (await cookies()).set(DEV_COOKIE, devSessionValue(email), cookieOptions);
      redirect(next);
    }
    if (!supabaseConfig()) throw new AppError("Sign-in isn't configured yet.");
    // Same answer either way, so the form doesn't reveal who has access.
    if (await mayRequestSignIn(email)) {
      const supabase = await supabaseServer();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
      });
      if (error) {
        console.error("[knowledge-lock] sign-in link failed", error.message);
        if (error.status === 429) throw new AppError("Too many sign-in emails. Please wait a minute and try again.");
        throw new AppError("We couldn't send the email. Please try again.");
      }
    }
    return { sentTo: email };
  });
}

export async function signOut() {
  const store = await cookies();
  store.delete(DEV_COOKIE);
  store.delete(ORG_COOKIE);
  if (supabaseConfig()) await (await supabaseServer()).auth.signOut();
  redirect("/signin");
}

// ---------- Invites and profile ----------

export async function acceptInviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const user = await getUser();
    if (!user) throw new AppError("Please sign in first.");
    const orgId = await acceptInvite(str(fd, "token"), user, str(fd, "name"), str(fd, "title"));
    (await cookies()).set(ORG_COOKIE, orgId, { ...cookieOptions, maxAge: YEAR });
    redirect("/app");
  });
}

export async function saveProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user } = await getContext();
    await saveProfile(user, str(fd, "name"), str(fd, "title"));
    revalidatePath("/app", "layout");
    return { message: "Saved." };
  });
}

export async function switchOrg(fd: FormData) {
  const { memberships } = await getContext();
  const orgId = str(fd, "orgId");
  if (memberships.some((m) => m.orgId === orgId)) {
    (await cookies()).set(ORG_COOKIE, orgId, { ...cookieOptions, maxAge: YEAR });
  }
  redirect("/app");
}

// ---------- Team ----------

async function currentOrg() {
  const ctx = await getContext();
  if (!ctx.current) throw new AppError("You're not in an organisation yet.");
  return { ...ctx, org: ctx.current };
}

export async function inviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, profile, org } = await currentOrg();
    const email = checkEmail(str(fd, "email"));
    const role = str(fd, "role") as Role;
    const { token } = await createInvite(org.orgId, user, email, role);
    const link = `${appUrl()}/invite/${token}`;
    const mail = inviteEmail({ orgName: org.orgName, inviter: profile?.name || user.email, role: ROLE_LABEL[role].toLowerCase(), url: link });
    const sent = await sendEmail(email, mail.subject, mail.html, mail.text);
    revalidatePath("/app/team");
    return {
      message: sent ? `Invite sent to ${email}.` : `Invite created for ${email}. Email isn't set up yet, so send them this link:`,
      link: sent ? undefined : link,
    };
  });
}

export async function revokeInviteAction(fd: FormData) {
  const { user, org } = await currentOrg();
  await revokeInvite(org.orgId, user, str(fd, "inviteId"));
  revalidatePath("/app/team");
}

export async function changeRoleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, org } = await currentOrg();
    await changeRole(org.orgId, user, str(fd, "userId"), str(fd, "role"));
    revalidatePath("/app/team");
    return { message: "Role updated." };
  });
}

export async function removeMemberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, org } = await currentOrg();
    await removeMember(org.orgId, user, str(fd, "userId"));
    revalidatePath("/app/team");
    return { message: "Removed." };
  });
}

// ---------- Admin ----------

export async function createOrgAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, profile } = await getContext();
    const { name, ownerEmail, token } = await createOrganisation(user, str(fd, "name"), str(fd, "ownerEmail"));
    const link = `${appUrl()}/invite/${token}`;
    const mail = inviteEmail({ orgName: name, inviter: profile?.name || "Guided Orchestration", role: "owner", url: link });
    const sent = await sendEmail(ownerEmail, mail.subject, mail.html, mail.text);
    revalidatePath("/app/admin");
    return {
      message: sent ? `${name} created. Invite sent to ${ownerEmail}.` : `${name} created. Email isn't set up yet, so send ${ownerEmail} this link:`,
      link: sent ? undefined : link,
    };
  });
}
