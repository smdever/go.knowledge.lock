import { NextResponse } from "next/server";
import { getUser } from "@/lib/app/auth";
import { exportOrganisation } from "@/lib/app/closure";
import { AppError } from "@/lib/app/orgs";

export const maxDuration = 120;

/** GET ?org=ID: everything in an organisation, as a JSON download. Owners only. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const orgId = new URL(request.url).searchParams.get("org") ?? "";
  try {
    const data = await exportOrganisation(orgId, user);
    const slug = data.organisation.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "organisation";
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="knowledge-lock-${slug}-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
