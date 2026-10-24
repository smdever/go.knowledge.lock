import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendOnboardingReminders } from "@/lib/app/onboarding";

export const maxDuration = 60;

/** Once a day (see vercel.json). Vercel sends CRON_SECRET as a bearer token; without it set, nothing runs. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    return NextResponse.json({ reminded: await sendOnboardingReminders() });
  } catch (err) {
    console.error("[knowledge-lock] onboarding reminders", err);
    return NextResponse.json({ error: "Reminders failed." }, { status: 500 });
  }
}
