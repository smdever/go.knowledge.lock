import { NextResponse } from "next/server";
import { DemoError } from "@/lib/demo/service";
import { getUser, type AppUser } from "./auth";
import { AppError } from "./orgs";

/** Product API wrapper: signed-in users only; known errors become JSON with their status. */
export async function appHandle<T>(fn: (user: AppUser) => Promise<T>): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    return NextResponse.json(await fn(user));
  } catch (err) {
    if (err instanceof DemoError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[knowledge-lock]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
