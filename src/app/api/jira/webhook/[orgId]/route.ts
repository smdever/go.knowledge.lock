import { after, NextResponse } from "next/server";
import { DemoError } from "@/lib/demo/service";
import { acceptWebhook } from "@/lib/app/jira";

export const maxDuration = 120;

/**
 * Jira Cloud webhook (Settings › System › WebHooks), signed with the secret shown on the Integrations page.
 * Replies straight away; any automatic check runs after the response.
 */
export async function POST(request: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "Too large." }, { status: 413 });
  try {
    const work = await acceptWebhook(orgId, raw, request.headers.get("x-hub-signature"));
    if (work) after(work);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    if (err instanceof DemoError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[knowledge-lock] jira webhook", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
