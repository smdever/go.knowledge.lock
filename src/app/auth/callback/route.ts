import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext, supabaseConfig, supabaseServer } from "@/lib/app/auth";

/**
 * Where the sign-in email lands. Handles both Supabase link styles:
 * `?code=` (opened in the same browser) and `?token_hash=&type=` (works on any device). The magic-link
 * email template should be:
 *   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // `next` comes straight in, or inside `redirect_to` when the email template passes Supabase's redirect address.
  let nextParam = url.searchParams.get("next");
  const redirectTo = url.searchParams.get("redirect_to");
  if (!nextParam && redirectTo) {
    try {
      nextParam = new URL(redirectTo).searchParams.get("next");
    } catch {
      nextParam = null;
    }
  }
  const next = safeNext(nextParam);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const origin = url.origin; // send people back to the address they actually used
  if (!supabaseConfig()) return NextResponse.redirect(new URL("/signin?error=link", origin));
  const supabase = await supabaseServer();

  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  return NextResponse.redirect(new URL(ok ? next : `/signin?error=link&next=${encodeURIComponent(next)}`, origin));
}
