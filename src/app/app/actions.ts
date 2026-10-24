"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appUrl } from "@/lib/mode";
import { DEV_COOKIE, devAuthEnabled, devSessionValue, getUser, safeNext, supabaseConfig, supabaseServer } from "@/lib/app/auth";
import { getContext, ORG_COOKIE } from "@/lib/app/context";
import { inviteEmail, sendEmail } from "@/lib/app/email";
import { createApiKey, revokeApiKey } from "@/lib/app/apikeys";
import {
  acceptInvite,
  AppError,
  changeRole,
  checkEmail,
  createInvite,
  createOrganisation,
  isAdmin,
  mayRequestSignIn,
  removeMember,
  revokeInvite,
  ROLE_LABEL,
  saveProfile,
  setRequirePasskeys,
  type Role,
} from "@/lib/app/orgs";
import { removePasskey } from "@/lib/app/passkeys";
import { addChannel, checkSlackId, removeChannel, testChannel } from "@/lib/app/channels";
import { connectJira, disconnectJira, setAutoCheck } from "@/lib/app/jira";
import { appDb } from "@/lib/app/db";
import { closeAccessRequest, getAccessRequest, submitAccessRequest } from "@/lib/app/access";
import { withdrawPasskeySignOffs } from "@/lib/app/records";
import { dismissOnboarding } from "@/lib/app/onboarding";
import { deleteAccount, leaveOrganisation } from "@/lib/app/account";
import { cancelClosure, closeOrganisation } from "@/lib/app/closure";

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

/** KL_APP_URL when set; otherwise the address this request came in on, so links never point at localhost. */
async function baseUrl(): Promise<string> {
  if (process.env.KL_APP_URL) return appUrl();
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return appUrl();
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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
    if (!supabaseConfig()) {
      console.error("[knowledge-lock] sign-in needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or the NEXT_PUBLIC_ versions)");
      throw new AppError("Sign-in isn't configured yet.");
    }
    // Same answer either way, so the form doesn't reveal who has access.
    if (await mayRequestSignIn(email)) {
      const supabase = await supabaseServer();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${await baseUrl()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
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
    const link = `${await baseUrl()}/invite/${token}`;
    const mail = inviteEmail({
      orgName: org.orgName,
      inviter: { name: profile?.name || user.email, title: profile?.title, email: user.email },
      role,
      url: link,
    });
    const sent = await sendEmail(email, mail.subject, mail.html, mail.text, { fromName: mail.fromName, replyTo: mail.replyTo });
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

// ---------- API keys ----------

export async function createApiKeyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, org } = await currentOrg();
    const { key, name } = await createApiKey(org.orgId, user, str(fd, "name"));
    revalidatePath("/app/api-keys");
    return { message: `Key "${name}" created. Copy it now: you won't be able to see it again.`, link: key };
  });
}

export async function revokeApiKeyAction(fd: FormData) {
  const { user, org } = await currentOrg();
  await revokeApiKey(org.orgId, user, str(fd, "keyId"));
  revalidatePath("/app/api-keys");
}

// ---------- Admin ----------

export async function createOrgAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, profile } = await getContext();
    const { name, ownerEmail, token } = await createOrganisation(user, str(fd, "name"), str(fd, "ownerEmail"));
    const link = `${await baseUrl()}/invite/${token}`;
    const mail = inviteEmail({
      orgName: name,
      inviter: { name: profile?.name || "Guided Orchestration", title: profile?.title, email: user.email },
      onBehalfOf: "Guided Orchestration",
      role: "owner",
      url: link,
    });
    const sent = await sendEmail(ownerEmail, mail.subject, mail.html, mail.text, { fromName: mail.fromName, replyTo: mail.replyTo });
    revalidatePath("/app/admin");
    return {
      message: sent ? `${name} created. Invite sent to ${ownerEmail}.` : `${name} created. Email isn't set up yet, so send ${ownerEmail} this link:`,
      link: sent ? undefined : link,
    };
  });
}

// ---------- Personal signing keys ----------

export async function removePasskeyAction(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/signin");
  const id = str(fd, "id");
  if (await removePasskey(user, id)) await withdrawPasskeySignOffs(user.id, id);
  revalidatePath("/app/profile");
}

export async function setRequirePasskeysAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await getContext("/app/team");
    if (!current) throw new AppError("Choose an organisation first.");
    const on = str(fd, "require") === "on";
    await setRequirePasskeys(current.orgId, user, on);
    revalidatePath("/app/team");
    return {
      message: on
        ? "Done. From now on, new records need each sign-off to be signed with a passkey."
        : "Done. New records accept sign-offs without a passkey. People who have one still sign with it.",
    };
  });
}

// ---------- Slack and Teams ----------

async function ownerOrg() {
  const { user, current } = await getContext("/app/integrations");
  if (!current) throw new AppError("Choose an organisation first.");
  return { user, current };
}

export async function addChannelAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await ownerOrg();
    const channel = await addChannel(current.orgId, user, {
      kind: str(fd, "kind"),
      name: str(fd, "name"),
      url: str(fd, "url"),
      events: fd.getAll("events"),
    });
    const test = await testChannel(current.orgId, user, channel.id, current.orgName);
    revalidatePath("/app/integrations");
    return test.ok
      ? { message: `Connected ${channel.name}. We posted a test message there.` }
      : { error: `Saved ${channel.name}, but the test message failed: ${test.error}` };
  });
}

export async function testChannelAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await ownerOrg();
    const test = await testChannel(current.orgId, user, str(fd, "id"), current.orgName);
    revalidatePath("/app/integrations");
    return test.ok ? { message: "Test message sent." } : { error: test.error };
  });
}

export async function removeChannelAction(fd: FormData) {
  const { user, current } = await ownerOrg();
  await removeChannel(current.orgId, user, str(fd, "id"));
  revalidatePath("/app/integrations");
}

export async function saveSlackIdAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user } = await getContext("/app/profile");
    const id = checkSlackId(str(fd, "slackId"));
    const db = await appDb();
    await db`UPDATE kl_profiles SET slack_member_id = ${id}, updated_at = now() WHERE user_id = ${user.id}`;
    revalidatePath("/app/profile");
    return { message: id ? "Saved. Slack notices will @mention you." : "Removed." };
  });
}

// ---------- Access requests ----------

export async function requestAccessAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
    await submitAccessRequest(
      {
        name: str(fd, "name"),
        email: str(fd, "email"),
        company: str(fd, "company"),
        title: str(fd, "title"),
        message: str(fd, "message"),
        website: str(fd, "website"),
      },
      ip
    );
    return { sentTo: str(fd, "email").trim() };
  });
}

/** Admin: create the requester's organisation and invite them as its owner. */
export async function approveAccessAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, profile } = await getContext("/app/admin");
    if (!isAdmin(user.email)) throw new AppError("You don't have permission to do that.");
    const req = await getAccessRequest(str(fd, "id"));
    if (!req) throw new AppError("That request has already been dealt with.");
    const orgName = str(fd, "orgName").trim() || req.company;
    const { orgId, name, ownerEmail, token } = await createOrganisation(user, orgName, req.email);
    await closeAccessRequest(user, req.id, "approved", orgId);
    const link = `${await baseUrl()}/invite/${token}`;
    const mail = inviteEmail({
      orgName: name,
      inviter: { name: profile?.name || "Guided Orchestration", title: profile?.title, email: user.email },
      onBehalfOf: "Guided Orchestration",
      role: "owner",
      url: link,
    });
    const sent = await sendEmail(ownerEmail, mail.subject, mail.html, mail.text, { fromName: mail.fromName, replyTo: mail.replyTo });
    revalidatePath("/app/admin");
    return {
      message: sent ? `${name} created. Invite sent to ${ownerEmail}.` : `${name} created. Email isn't set up yet, so send ${ownerEmail} this link:`,
      link: sent ? undefined : link,
    };
  });
}

export async function dismissAccessAction(fd: FormData) {
  const { user } = await getContext("/app/admin");
  if (!isAdmin(user.email)) return;
  await closeAccessRequest(user, str(fd, "id"), "dismissed");
  revalidatePath("/app/admin");
}

// ---------- Jira ----------

export async function connectJiraAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await ownerOrg();
    const { site, accountName } = await connectJira(current.orgId, user, { site: str(fd, "site"), email: str(fd, "email"), token: str(fd, "token") });
    revalidatePath("/app/integrations");
    return { message: `Connected to ${site.replace(/^https:\/\//, "")} as ${accountName}.` };
  });
}

export async function disconnectJiraAction() {
  const { user, current } = await ownerOrg();
  await disconnectJira(current.orgId, user);
  revalidatePath("/app/integrations");
}

export async function setJiraAutoCheckAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await ownerOrg();
    const on = str(fd, "auto") === "on";
    await setAutoCheck(current.orgId, user, on);
    revalidatePath("/app/integrations");
    return { message: on ? "Linked issues will be re-checked when they change." : "Automatic checks are off." };
  });
}

export async function dismissOnboardingAction() {
  const { user, current } = await ownerOrg();
  await dismissOnboarding(current.orgId, user);
  revalidatePath("/app");
}

// ---------- Your data, leaving and closing ----------

export async function leaveOrgAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user } = await getContext("/app/profile");
    await leaveOrganisation(str(fd, "orgId"), user);
    (await cookies()).delete(ORG_COOKIE);
    redirect("/app");
  });
}

export async function deleteAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user } = await getContext("/app/profile");
    await deleteAccount(user, str(fd, "confirm"));
    const store = await cookies();
    store.delete(DEV_COOKIE);
    store.delete(ORG_COOKIE);
    if (supabaseConfig()) await (await supabaseServer()).auth.signOut().catch(() => {});
    redirect("/signin?deleted=1");
  });
}

export async function closeOrgAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await ownerOrg();
    await closeOrganisation(current.orgId, user, str(fd, "confirm"));
    revalidatePath("/app", "layout");
    return { message: "Closing." };
  });
}

export async function cancelClosureAction(_prev: FormState): Promise<FormState> {
  return attempt(async () => {
    const { user, current } = await ownerOrg();
    await cancelClosure(current.orgId, user);
    revalidatePath("/app", "layout");
    return { message: "Cancelled." };
  });
}
