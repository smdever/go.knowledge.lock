import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PRODUCT_ROUTES = [/^\/app(\/|$)/, /^\/api\/app\//, /^\/api\/v1\//, /^\/api\/jira\//, /^\/api\/cron\//, /^\/signin(\/|$)/, /^\/request-access(\/|$)/, /^\/auth\//, /^\/invite\//];
const DEMO_ROUTES = [/^\/r\//, /^\/l\//, /^\/api\/records/, /^\/api\/locks/];

const notFound = (request: NextRequest) => NextResponse.rewrite(new URL("/_kl-not-found", request.url));

/**
 * Keeps the demo and the product apart (KL_MODE), and in the product refreshes the Supabase
 * sign-in session on every request.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const appMode = process.env.KL_MODE === "app";

  if (!appMode) return PRODUCT_ROUTES.some((r) => r.test(path)) ? notFound(request) : NextResponse.next();

  if (DEMO_ROUTES.some((r) => r.test(path))) return notFound(request);

  // Product API calls that change things must come from the product's own pages.
  if (path.startsWith("/api/app/") && request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
    }
  }
  if (path === "/") return NextResponse.redirect(new URL("/app", request.url));
  // The public API uses API keys, Jira's webhook a signature and scheduled jobs a secret, not sign-in cookies.
  if (path.startsWith("/api/v1/") || path.startsWith("/api/jira/") || path.startsWith("/api/cron/")) return NextResponse.next();

  const env = process.env;
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes an expired session if needed; otherwise verifies the token locally.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
