import { NextResponse } from "next/server";
import { chargeUsage, DemoError } from "@/lib/demo/service";
import { keyFromRequest } from "./apikeys";
import { audit, AppError, closingDate, longDate } from "./orgs";
import { appUrl } from "@/lib/mode";

export interface ApiCaller {
  keyId: string;
  orgId: string;
  name: string;
}

/**
 * Public API wrapper: an organisation API key is required, every request counts towards the key's
 * hourly limit, and errors come back as `{ "error": "…" }` with a meaningful status. Errors an app needs
 * to tell apart also carry a `code`: invalid_key, org_closing, retired, not_found or rate_limited.
 */
export async function apiHandle<T>(request: Request, fn: (caller: ApiCaller) => Promise<T>, opts: { audit?: string } = {}) {
  const caller = await keyFromRequest(request);
  if (!caller) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Send it as: Authorization: Bearer kl_live_…", code: "invalid_key" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }
  const closing = await closingDate(caller.orgId);
  if (closing) {
    return NextResponse.json(
      { error: `${closing.name} is closing on Knowledge Lock, so the API is switched off. Everything will be deleted on ${longDate(closing.deleteAfter)}.`, code: "org_closing" },
      { status: 403 }
    );
  }
  try {
    await chargeUsage(`apikey:${caller.keyId}`, 1, {
      perHour: Number(process.env.KL_API_HOURLY_LIMIT || 1000),
      perDay: Number(process.env.KL_API_DAILY_LIMIT || 10000),
      dayKey: `api-org:${caller.orgId}`,
      hourMessage: "This key has reached its hourly request limit. Try again later.",
      dayMessage: "Your organisation has reached its daily API limit. Try again tomorrow.",
    });
    const result = await fn(caller);
    if (opts.audit) await audit(caller.orgId, null, opts.audit, undefined, { key: caller.name });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof DemoError) {
      const code = err.status === 410 ? "retired" : err.status === 429 ? "rate_limited" : err.status === 404 ? "not_found" : undefined;
      return NextResponse.json({ error: err.message, ...(code ? { code } : {}) }, { status: err.status, ...(err.status === 429 ? { headers: { "Retry-After": "3600" } } : {}) });
    }
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[knowledge-lock] api", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new DemoError("Send a JSON body.", 400);
  }
}

export const lockLink = (lockId: string) => `${appUrl()}/app/l/${lockId}`;
