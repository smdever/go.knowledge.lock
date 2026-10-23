import { readJson } from "@/lib/demo/http";
import { appHandle } from "@/lib/app/http";
import { finishRegistration, startRegistration } from "@/lib/app/passkeys";

/** GET: options for adding a passkey. POST: the browser's response, to verify and save it. */
export async function GET() {
  return appHandle((user) => startRegistration(user));
}

export async function POST(request: Request) {
  return appHandle(async (user) => {
    const body = await readJson(request);
    return finishRegistration(user, body.response, request.headers.get("user-agent"));
  });
}
