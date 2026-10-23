import { cookies } from "next/headers";
import { readJson } from "@/lib/demo/http";
import { DemoError } from "@/lib/demo/service";
import { ORG_COOKIE } from "@/lib/app/context";
import { appHandle } from "@/lib/app/http";
import { listMemberships } from "@/lib/app/orgs";
import { createRecord, lockOrg, recordFor, viewFor } from "@/lib/app/records";

/** New record, or a new version of a locked one (`parentLockId`). */
export async function POST(request: Request) {
  return appHandle(async (user) => {
    const body = await readJson(request);
    let orgId: string | null;
    if (typeof body.parentLockId === "string" && body.parentLockId) {
      orgId = await lockOrg(user, body.parentLockId);
    } else {
      const memberships = await listMemberships(user.id);
      const chosen = (await cookies()).get(ORG_COOKIE)?.value;
      orgId = (memberships.find((m) => m.orgId === chosen) ?? memberships[0])?.orgId ?? null;
    }
    if (!orgId) throw new DemoError("Organisation not found.", 404);
    const record = await createRecord(user, orgId, body);
    const { role } = await recordFor(user, record.id, "read");
    return viewFor(record, user, role);
  });
}
