import { NextResponse } from "next/server";
import { getUser } from "@/lib/app/auth";
import { exportMyData } from "@/lib/app/account";

/** GET: everything held about the signed-in person, as a JSON download. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const data = await exportMyData(user);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="knowledge-lock-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
