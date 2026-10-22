import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PRODUCT_ROUTES = [/^\/app(\/|$)/, /^\/signin(\/|$)/, /^\/auth\//, /^\/invite\//];
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
  if (path === "/") return NextResponse.redirect(new URL("/app", request.url));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
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
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
