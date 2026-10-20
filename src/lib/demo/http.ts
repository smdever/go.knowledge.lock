import { NextResponse } from "next/server";
import { DemoError } from "./service";

/** Wraps a route handler: DemoErrors become JSON with their status, anything else a 500. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof DemoError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[knowledge-lock]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
