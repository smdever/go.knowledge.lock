"use client";

import { request } from "@/lib/demo/client";
import type { RecordView } from "@/lib/demo/types";

/** Turns the browser's passkey errors into something a person can act on. */
function passkeyError(err: unknown): Error {
  const name = (err as { name?: string; code?: string })?.name;
  const code = (err as { code?: string })?.code;
  if (name === "NotAllowedError" || code === "ERROR_CEREMONY_ABORTED") {
    return new Error("The passkey request was cancelled or timed out. Nothing was signed.");
  }
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError") {
    return new Error("This device's passkey is already on your account.");
  }
  if (name === "SecurityError") return new Error("Passkeys only work on the Knowledge Lock site itself.");
  return new Error("Your browser couldn't use a passkey here. Try another browser or device.");
}

const supported = () => typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";

export async function addPasskey(): Promise<void> {
  if (!supported()) throw new Error("This browser doesn't support passkeys. Try a recent version of Chrome, Safari, Edge or Firefox.");
  const { startRegistration } = await import("@simplewebauthn/browser");
  const optionsJSON = await request<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/app/passkeys/register");
  let response;
  try {
    response = await startRegistration({ optionsJSON });
  } catch (err) {
    throw passkeyError(err);
  }
  await request("/api/app/passkeys/register", { method: "POST", body: JSON.stringify({ response }) });
}

type SignRequest =
  | { passkey: false }
  | { passkey: true; timestamp: number; options: { challenge: string; rpId: string; allowCredentials: { id: string; type: "public-key"; transports?: string[] }[]; userVerification: "required"; timeout: number } };

/** A product sign-off: signed with the person's passkey when they have one. */
export async function productSignOff(id: string, decision: "APPROVE" | "REJECT", comment?: string): Promise<RecordView> {
  const url = `/api/app/records/${id}`;
  const req = await request<SignRequest>(`${url}/sign-request`, { method: "POST", body: JSON.stringify({ decision, comment }) });
  if (!req.passkey) {
    return request<RecordView>(`${url}/approve`, { method: "POST", body: JSON.stringify({ decision, comment }) });
  }
  if (!supported()) throw new Error("This browser doesn't support passkeys, which your sign-off needs. Try another browser or device.");
  const { startAuthentication } = await import("@simplewebauthn/browser");
  let passkey;
  try {
    passkey = await startAuthentication({
      optionsJSON: req.options as Parameters<typeof startAuthentication>[0]["optionsJSON"],
    });
  } catch (err) {
    throw passkeyError(err);
  }
  return request<RecordView>(`${url}/approve`, {
    method: "POST",
    body: JSON.stringify({ decision, comment, timestamp: req.timestamp, passkey }),
  });
}
