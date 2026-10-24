import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { purgeDueOrganisations } from "@/lib/app/closure";
import { sendOnboardingReminders } from "@/lib/app/onboarding";

export const maxDuration = 300;

/**
 * Once a day (see vercel.json): deletes organisations whose 30 days of closing are up, and sends
 * getting-started reminders. Vercel sends CRON_SECRET as a bearer token; without it set, nothing runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const result: Record<string, number | string> = {};
  for (const [name, job] of [
    ["deleted", purgeDueOrganisations],
    ["reminded", sendOnboardingReminders],
  ] as const) {
    try {
      result[name] = await job();
    } catch (err) {
      console.error(`[knowledge-lock] daily job ${name}`, err);
      result[name] = "failed";
    }
  }
  return NextResponse.json(result, { status: Object.values(result).includes("failed") ? 500 : 200 });
}
