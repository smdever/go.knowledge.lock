import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext, supabaseConfig, supabaseServer } from "@/lib/app/auth";
import { appUrl } from "@/lib/mode";

/**
 * Where the sign-in email lands. Handles both Supabase link styles:
 * `?code=` (opened in the same browser) and `?token_hash=&type=` (works on any device, see DEPLOY.md).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!supabaseConfig()) return NextResponse.redirect(new URL("/signin?error=link", appUrl()));
  const supabase = await supabaseServer();

  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  return NextResponse.redirect(new URL(ok ? next : `/signin?error=link&next=${encodeURIComponent(next)}`, appUrl()));
}
