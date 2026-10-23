import { cache } from "react";
import { cookies } from "next/headers";
import { requireUser, type AppUser } from "./auth";
import { getProfile, isAdmin, listMemberships, type Membership, type Profile } from "./orgs";

export const ORG_COOKIE = "kl_org";

export interface AppContext {
  user: AppUser;
  profile: Profile | null;
  memberships: Membership[];
  /** The organisation the person is working in: their last choice, or their first. */
  current: Membership | null;
  admin: boolean;
}

const loadContext = cache(async (user: AppUser) => {
  const [memberships, profile] = await Promise.all([listMemberships(user.id), getProfile(user.id)]);
  const chosen = (await cookies()).get(ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.orgId === chosen) ?? memberships[0] ?? null;
  return { user, profile, memberships, current, admin: isAdmin(user.email) };
});

export async function getContext(next = "/app"): Promise<AppContext> {
  return loadContext(await requireUser(next));
}
