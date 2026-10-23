import {
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { cose, decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";
import {
  issueKeyCertificate,
  PASSKEY_ALGORITHMS,
  signOffChallenge,
  toBase64Url,
  verifyPersonalSignature,
  type Attestation,
  type PasskeyAlgorithm,
  type PersonalSignature,
} from "@/lib/protocol";
import { getAuthorityKey } from "@/lib/demo/authority";
import { DemoError } from "@/lib/demo/service";
import { appUrl } from "@/lib/mode";
import type { AppUser } from "./auth";
import { appDb } from "./db";
import { noticeEmail, sendEmail } from "./email";
import { AppError, audit, getProfile, listMemberships } from "./orgs";

/**
 * Personal signing keys. Each person can add passkeys (Touch ID, Face ID, Windows Hello, a phone or a
 * security key). Their sign-offs are then signed on their own device, and the lock authority certifies
 * at lock time that the passkey is theirs. We only ever hold public keys.
 */
const MAX_PASSKEYS = 10;
const CHALLENGE_MINUTES = 5;
/** How old a signed sign-off statement may be when it reaches us. */
export const SIGN_WINDOW_MS = 5 * 60 * 1000;

export function relyingParty() {
  const url = new URL(appUrl());
  return { rpID: url.hostname, origin: url.origin, rpName: "Knowledge Lock" };
}

export interface PasskeySummary {
  id: string;
  name: string;
  synced: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

interface PasskeyRow {
  id: string;
  userId: string;
  publicKey: Uint8Array;
  jwk: JsonWebKey;
  alg: PasskeyAlgorithm;
  counter: string;
  transports: string[];
  createdAt: Date;
}

export async function listPasskeys(userId: string): Promise<PasskeySummary[]> {
  const db = await appDb();
  return db<PasskeySummary[]>`
    SELECT id, name, synced, created_at AS "createdAt", last_used_at AS "lastUsedAt"
    FROM kl_passkeys WHERE user_id = ${userId} AND removed_at IS NULL ORDER BY created_at`;
}

export async function hasPasskey(userId: string): Promise<boolean> {
  const db = await appDb();
  const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM kl_passkeys WHERE user_id = ${userId} AND removed_at IS NULL`;
  return r.n > 0;
}

export async function usersWithPasskeys(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const db = await appDb();
  const rows = await db<{ userId: string }[]>`
    SELECT DISTINCT user_id AS "userId" FROM kl_passkeys WHERE user_id = ANY(${userIds}) AND removed_at IS NULL`;
  return new Set(rows.map((r) => r.userId));
}

async function activePasskey(id: string, userId: string): Promise<PasskeyRow | null> {
  const db = await appDb();
  const [row] = await db<PasskeyRow[]>`
    SELECT id, user_id AS "userId", public_key AS "publicKey", jwk, alg, counter, transports, created_at AS "createdAt"
    FROM kl_passkeys WHERE id = ${id} AND user_id = ${userId} AND removed_at IS NULL`;
  return row ?? null;
}

/** COSE public key (as stored by the authenticator) to a JWK any WebCrypto can import. */
function coseToJwk(bytes: Uint8Array): { jwk: JsonWebKey; alg: PasskeyAlgorithm } {
  const key = decodeCredentialPublicKey(new Uint8Array(bytes));
  const alg = key.get(cose.COSEKEYS.alg) as number;
  if (!PASSKEY_ALGORITHMS.includes(alg as PasskeyAlgorithm)) throw new AppError("This passkey uses an algorithm we don't support yet.");
  const b = (v: unknown) => toBase64Url(v as Uint8Array);
  if (cose.isCOSEPublicKeyEC2(key)) {
    if (key.get(cose.COSEKEYS.crv) !== 1) throw new AppError("This passkey uses a curve we don't support yet.");
    return { jwk: { kty: "EC", crv: "P-256", x: b(key.get(cose.COSEKEYS.x)), y: b(key.get(cose.COSEKEYS.y)) }, alg: -7 };
  }
  if (cose.isCOSEPublicKeyOKP(key)) {
    if (key.get(cose.COSEKEYS.crv) !== 6) throw new AppError("This passkey uses a curve we don't support yet.");
    return { jwk: { kty: "OKP", crv: "Ed25519", x: b(key.get(cose.COSEKEYS.x)) }, alg: -8 };
  }
  if (cose.isCOSEPublicKeyRSA(key)) {
    return { jwk: { kty: "RSA", n: b(key.get(cose.COSEKEYS.n)), e: b(key.get(cose.COSEKEYS.e)) }, alg: -257 };
  }
  throw new AppError("This kind of passkey isn't supported yet.");
}

/** A friendly label from the browser, e.g. "Mac" or "iPhone". */
function deviceName(userAgent: string | null, synced: boolean): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux|CrOS/.test(ua)
              ? "Computer"
              : "Device";
  return `${device} passkey${synced ? " (synced)" : ""}`;
}

async function tellOrgs(user: AppUser, action: string, target: string) {
  for (const m of await listMemberships(user.id)) await audit(m.orgId, user, action, target);
}

async function tellUser(user: AppUser, heading: string, lines: string[]) {
  const orgs = await listMemberships(user.id);
  const mail = noticeEmail({
    orgName: orgs[0]?.orgName ?? "Knowledge Lock",
    subject: heading,
    heading,
    lines,
    cta: "See your passkeys",
    url: `${appUrl()}/app/profile`,
  });
  await sendEmail(user.email, mail.subject, mail.html, mail.text).catch((err) => console.error("[knowledge-lock] passkey email", err));
}

// ---------- Adding and removing ----------

export async function startRegistration(user: AppUser) {
  const db = await appDb();
  const existing = await db<{ id: string; transports: string[] }[]>`
    SELECT id, transports FROM kl_passkeys WHERE user_id = ${user.id} AND removed_at IS NULL`;
  if (existing.length >= MAX_PASSKEYS) throw new AppError(`You can have up to ${MAX_PASSKEYS} passkeys. Remove one first.`);
  const profile = await getProfile(user.id);
  const { rpID, rpName } = relyingParty();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: profile?.name || user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((k) => ({ id: k.id, transports: k.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    supportedAlgorithmIDs: [-8, -7, -257],
    timeout: 120_000,
  });
  await db`INSERT INTO kl_passkey_challenges (user_id, challenge, expires_at)
           VALUES (${user.id}, ${options.challenge}, now() + make_interval(mins => ${CHALLENGE_MINUTES}))
           ON CONFLICT (user_id) DO UPDATE SET challenge = EXCLUDED.challenge, expires_at = EXCLUDED.expires_at`;
  return options;
}

export async function finishRegistration(user: AppUser, response: unknown, userAgent: string | null): Promise<PasskeySummary> {
  if (!response || typeof response !== "object") throw new AppError("The passkey response was missing. Please try again.");
  const db = await appDb();
  const [c] = await db<{ challenge: string }[]>`
    DELETE FROM kl_passkey_challenges WHERE user_id = ${user.id} AND expires_at > now() RETURNING challenge`;
  if (!c) throw new AppError("That took too long. Please try adding the passkey again.");
  const { rpID, origin } = relyingParty();
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-8, -7, -257],
    });
  } catch (err) {
    console.warn("[knowledge-lock] passkey registration rejected", (err as Error).message);
    throw new AppError("We couldn't add that passkey. Please try again.");
  }
  if (!verified.verified) throw new AppError("We couldn't add that passkey. Please try again.");
  const info = verified.registrationInfo;
  const { jwk, alg } = coseToJwk(info.credential.publicKey);
  const synced = info.credentialBackedUp;
  const name = deviceName(userAgent, synced);
  const [row] = await db<PasskeySummary[]>`
    INSERT INTO kl_passkeys (id, user_id, public_key, jwk, alg, counter, transports, name, synced)
    VALUES (${info.credential.id}, ${user.id}, ${Buffer.from(info.credential.publicKey)}, ${db.json(jwk as never)}, ${alg},
            ${info.credential.counter}, ${info.credential.transports ?? []}, ${name}, ${synced})
    ON CONFLICT (id) DO NOTHING
    RETURNING id, name, synced, created_at AS "createdAt", last_used_at AS "lastUsedAt"`;
  if (!row) throw new AppError("That passkey has already been added.");
  await tellOrgs(user, "passkey.added", name);
  await tellUser(user, "A passkey was added to your Knowledge Lock account", [
    `A passkey (${name}) was added on ${new Date().toUTCString()}. Your sign-offs can now be signed with it.`,
    "If this wasn't you, remove it from your profile straight away and tell your organisation's owner.",
  ]);
  return row;
}

export async function removePasskey(user: AppUser, id: string): Promise<boolean> {
  const db = await appDb();
  const [row] = await db<{ name: string }[]>`
    UPDATE kl_passkeys SET removed_at = now() WHERE id = ${id} AND user_id = ${user.id} AND removed_at IS NULL RETURNING name`;
  if (!row) return false;
  await tellOrgs(user, "passkey.removed", row.name);
  await tellUser(user, "A passkey was removed from your Knowledge Lock account", [
    `The passkey "${row.name}" was removed on ${new Date().toUTCString()}. Any sign-offs it made on records that aren't locked yet have been withdrawn, so please sign them again.`,
    "If this wasn't you, tell your organisation's owner.",
  ]);
  return true;
}

// ---------- Signing ----------

/** What the browser needs to ask the person's passkey to sign this sign-off. */
export async function signingRequest(userId: string, attestation: Attestation) {
  const db = await appDb();
  const keys = await db<{ id: string; transports: string[] }[]>`
    SELECT id, transports FROM kl_passkeys WHERE user_id = ${userId} AND removed_at IS NULL`;
  const { rpID } = relyingParty();
  return {
    challenge: await signOffChallenge(attestation),
    rpId: rpID,
    allowCredentials: keys.map((k) => ({ id: k.id, type: "public-key" as const, transports: k.transports })),
    userVerification: "required" as const,
    timeout: 120_000,
  };
}

/** Checks the person's passkey signed exactly this sign-off, and returns the signature to store with it. */
export async function verifySigning(userId: string, attestation: Attestation, response: unknown): Promise<PersonalSignature> {
  const r = response as AuthenticationResponseJSON | null;
  if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.response) throw new DemoError("The passkey response was missing. Please try again.");
  const key = await activePasskey(r.id, userId);
  if (!key) throw new DemoError("That passkey isn't on your account. Add it on your profile, then sign again.", 403);
  const { rpID, origin } = relyingParty();
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response: r,
      expectedChallenge: await signOffChallenge(attestation),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: key.id, publicKey: new Uint8Array(key.publicKey), counter: Number(key.counter), transports: key.transports },
      requireUserVerification: true,
    });
  } catch (err) {
    console.warn("[knowledge-lock] passkey signature rejected", (err as Error).message);
    throw new DemoError("Your passkey's signature didn't check out. Please sign again.", 400);
  }
  if (!result.verified) throw new DemoError("Your passkey's signature didn't check out. Please sign again.", 400);
  const signature: PersonalSignature = {
    type: "webauthn",
    rpId: rpID,
    origin,
    credentialId: key.id,
    alg: key.alg,
    publicKey: key.jwk,
    authenticatorData: r.response.authenticatorData,
    clientDataJSON: r.response.clientDataJSON,
    signature: r.response.signature,
  };
  // The same check anyone holding the lock will run later, so nothing we store fails it.
  const own = await verifyPersonalSignature({ ...attestation, personalSignature: signature });
  if (!own.valid) {
    console.warn("[knowledge-lock] passkey signature failed the protocol check", own.errors);
    throw new DemoError("Your passkey's signature didn't check out. Please sign again.", 400);
  }
  const db = await appDb();
  await db`UPDATE kl_passkeys SET counter = ${result.authenticationInfo.newCounter}, last_used_at = now() WHERE id = ${key.id}`;
  return signature;
}

/**
 * At lock time, the lock authority certifies that each passkey used belongs to the person who signed.
 * Returns null when the passkey has since been removed, so that sign-off no longer counts.
 */
export async function certify(a: Attestation): Promise<Attestation | null> {
  const p = a.personalSignature;
  if (!p) return a;
  const userId = a.role?.startsWith("user:") ? a.role.slice(5) : "";
  const key = userId ? await activePasskey(p.credentialId, userId) : null;
  if (!key) return null;
  const profile = await getProfile(userId);
  const certificate = await issueKeyCertificate(
    {
      kind: "knowledge-lock/signing-key",
      subject: a.role!,
      email: profile?.email ?? "",
      credentialId: key.id,
      publicKey: key.jwk,
      alg: key.alg,
      registeredAt: new Date(key.createdAt).getTime(),
    },
    await getAuthorityKey()
  );
  return { ...a, personalSignature: { ...p, certificate } };
}
