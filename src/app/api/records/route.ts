import { handle, readJson } from "@/lib/demo/http";
import { createRecord, viewRecord } from "@/lib/demo/service";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const parent = typeof body.parentLockId === "string" ? body.parentLockId : undefined;
    return viewRecord(await createRecord(parent));
  });
}
