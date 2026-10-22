import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export interface AppUser {
  id: string;
  email: string;
}

export const DEV_COOKIE = "kl_dev_session";

/**
 * Local testing only: sign in as any email without Supabase. Never active on Vercel.
 * Set KL_DEV_AUTH=1 in .env.local to use it.
 */
export const devAuthEnabled = () => process.env.KL_DEV_AUTH === "1" && !process.env.VERCEL;

const devSign = (email: string) =>
  createHmac("sha256", process.env.KL_DEV_AUTH_SECRET || "kl-dev-auth").update(email).digest("base64url");

export const devSessionValue = (email: string) => `${Buffer.from(email).toString("base64url")}.${devSign(email)}`;

function readDevSession(value: string | undefined): AppUser | null {
  if (!value) return null;
  const [b64, sig] = value.split(".");
  const email = Buffer.from(b64 ?? "", "base64url").toString();
  if (!email || sig !== devSign(email)) return null;
  return { id: `dev_${createHmac("sha256", "id").update(email).digest("hex").slice(0, 16)}`, email };
}

/**
 * Accepts the names Supabase's own guides and the Vercel integration use, as well as our own.
 * The publishable (anon) key is safe to expose; the secret/service-role key is never needed.
 */
export function supabaseConfig() {
  const env = process.env;
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** Supabase client bound to this request's cookies (server components, actions and routes). */
export async function supabaseServer() {
  const config = supabaseConfig();
  if (!config) throw new Error("Sign-in isn't configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export async function getUser(): Promise<AppUser | null> {
  if (devAuthEnabled()) {
    const dev = readDevSession((await cookies()).get(DEV_COOKIE)?.value);
    if (dev) return dev;
  }
  if (!supabaseConfig()) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  return data.user && email ? { id: data.user.id, email } : null;
}

export async function requireUser(next = "/app"): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}

/** Only allow redirects back into the product. */
export function safeNext(next: unknown, fallback = "/app"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
