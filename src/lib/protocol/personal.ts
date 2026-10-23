/**
 * Personal signatures: a person signs their own sign-off with a passkey (WebAuthn), and the lock
 * authority certifies, once, that the passkey belongs to them. Anyone holding a lock can check both,
 * offline, with WebCrypto alone.
 *
 * What the person signs: the passkey's challenge is the SHA-256 of the canonical sign-off statement
 * (the exact content hash, their decision and comment, who they are and when). WebAuthn then signs
 * authenticatorData || SHA-256(clientDataJSON), where clientDataJSON carries that challenge.
 */
import { canonicalizeJson } from "./canonicalize";
import { bufferToHex, defaultCryptoProvider, type CryptoProvider } from "./crypto";
import type { Attestation } from "./types";

/** COSE algorithm ids we accept: ES256, EdDSA (Ed25519) and RS256. */
export type PasskeyAlgorithm = -7 | -8 | -257;
export const PASSKEY_ALGORITHMS: PasskeyAlgorithm[] = [-7, -8, -257];

/** What the lock authority vouches for: this passkey belongs to this account. */
export interface KeyCertificateStatement {
  kind: "knowledge-lock/signing-key";
  /** Matches the attestation's role, e.g. "user:3f2a…". */
  subject: string;
  email: string;
  credentialId: string;
  publicKey: JsonWebKey;
  alg: PasskeyAlgorithm;
  registeredAt: number;
}

export interface KeyCertificate {
  statement: KeyCertificateStatement;
  /** Ed25519 signature by the lock authority over canonicalizeJson(statement). */
  signature: string;
  authorityPublicKey: string;
}

export interface PersonalSignature {
  type: "webauthn";
  rpId: string;
  origin: string;
  credentialId: string;
  alg: PasskeyAlgorithm;
  publicKey: JsonWebKey;
  /** base64url, exactly as the authenticator returned them. */
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  /** Added when the record is locked. */
  certificate?: KeyCertificate;
}

/** The fields of an attestation that a personal signature covers. */
export function signOffStatement(a: Pick<Attestation, "subjectHash" | "decision" | "attestorId" | "role" | "timestamp" | "reasoning">): string {
  return canonicalizeJson({
    kind: "knowledge-lock/sign-off",
    subjectHash: a.subjectHash ?? null,
    decision: a.decision,
    attestorId: a.attestorId,
    role: a.role ?? null,
    timestamp: a.timestamp,
    reasoning: a.reasoning ?? null,
  });
}

// ---------- encoding ----------

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const subtle = () => {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto SubtleCrypto is not available in this environment.");
  return globalThis.crypto.subtle;
};

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest("SHA-256", data as unknown as BufferSource));
}

/** The passkey challenge for a sign-off: base64url(SHA-256(statement)). */
export async function signOffChallenge(a: Parameters<typeof signOffStatement>[0]): Promise<string> {
  return toBase64Url(await sha256Bytes(new TextEncoder().encode(signOffStatement(a))));
}

/** ECDSA signatures from WebAuthn are DER; WebCrypto wants r || s. */
function derToRaw(der: Uint8Array, size = 32): Uint8Array {
  if (der[0] !== 0x30) throw new Error("Not a DER signature");
  let i = 2;
  if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const read = () => {
    if (der[i] !== 0x02) throw new Error("Bad DER integer");
    const len = der[i + 1];
    let v = der.slice(i + 2, i + 2 + len);
    i += 2 + len;
    while (v.length > size && v[0] === 0) v = v.slice(1);
    if (v.length > size) throw new Error("DER integer too long");
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  const r = read();
  const s = read();
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0);
  raw.set(s, size);
  return raw;
}

async function verifyWithJwk(alg: PasskeyAlgorithm, jwk: JsonWebKey, data: Uint8Array, sig: Uint8Array): Promise<boolean> {
  const s = subtle();
  const buf = (b: Uint8Array) => b as unknown as BufferSource;
  if (alg === -7) {
    const key = await s.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return s.verify({ name: "ECDSA", hash: "SHA-256" }, key, buf(derToRaw(sig)), buf(data));
  }
  if (alg === -8) {
    const key = await s.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
    return s.verify({ name: "Ed25519" }, key, buf(sig), buf(data));
  }
  if (alg === -257) {
    const key = await s.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return s.verify({ name: "RSASSA-PKCS1-v1_5" }, key, buf(sig), buf(data));
  }
  return false;
}

/** Only the parts of a public key that identify it, so two copies of the same key compare equal. */
export function jwkCore(jwk: JsonWebKey): JsonWebKey {
  const { kty, crv, x, y, n, e } = jwk;
  return Object.fromEntries(Object.entries({ kty, crv, x, y, n, e }).filter(([, v]) => v !== undefined)) as JsonWebKey;
}

export interface PersonalSignatureCheck {
  valid: boolean;
  errors: string[];
}

/**
 * Checks a person's passkey signature on their sign-off, and (when `requireCertificate`) that the lock
 * authority certified the passkey as theirs. `authorityPublicKey`, when given, must be the key that
 * issued the certificate.
 */
export async function verifyPersonalSignature(
  a: Attestation,
  opts: { requireCertificate?: boolean; authorityPublicKey?: string; crypto?: CryptoProvider } = {}
): Promise<PersonalSignatureCheck> {
  const errors: string[] = [];
  const p = a.personalSignature;
  const who = a.attestorId;
  if (!p || p.type !== "webauthn") return { valid: false, errors: [`${who}: no personal signature.`] };
  try {
    // 1. The browser's record of the request: a passkey sign-in, from our site, for exactly this statement.
    const clientBytes = fromBase64Url(p.clientDataJSON);
    const client = JSON.parse(new TextDecoder().decode(clientBytes)) as { type?: string; challenge?: string; origin?: string };
    if (client.type !== "webauthn.get") errors.push(`${who}: not a passkey signature.`);
    if (client.challenge !== (await signOffChallenge(a))) errors.push(`${who}: the passkey signed a different sign-off.`);
    if (client.origin !== p.origin) errors.push(`${who}: signed on a different site.`);

    // 2. The authenticator's data: for our site, with the person present and verified (PIN or biometric).
    const auth = fromBase64Url(p.authenticatorData);
    if (auth.length < 37) errors.push(`${who}: authenticator data is too short.`);
    else {
      const rpHash = bufferToHex(await sha256Bytes(new TextEncoder().encode(p.rpId)));
      if (bufferToHex(auth.slice(0, 32)) !== rpHash) errors.push(`${who}: passkey belongs to a different site.`);
      const flags = auth[32];
      if (!(flags & 0x01)) errors.push(`${who}: the person wasn't present.`);
      if (!(flags & 0x04)) errors.push(`${who}: the person wasn't verified by PIN or biometric.`);
    }

    // 3. The signature itself.
    const signed = new Uint8Array(auth.length + 32);
    signed.set(auth, 0);
    signed.set(await sha256Bytes(clientBytes), auth.length);
    if (!PASSKEY_ALGORITHMS.includes(p.alg)) errors.push(`${who}: unsupported passkey algorithm.`);
    else if (!(await verifyWithJwk(p.alg, p.publicKey, signed, fromBase64Url(p.signature)))) {
      errors.push(`${who}: passkey signature is invalid.`);
    }

    // 4. The authority's certificate that this passkey is theirs.
    const cert = p.certificate;
    if (cert) {
      const s = cert.statement;
      if (s.kind !== "knowledge-lock/signing-key") errors.push(`${who}: unrecognised key certificate.`);
      if (s.subject !== a.role) errors.push(`${who}: the key certificate is for someone else.`);
      if (s.credentialId !== p.credentialId || s.alg !== p.alg || canonicalizeJson(jwkCore(s.publicKey)) !== canonicalizeJson(jwkCore(p.publicKey))) {
        errors.push(`${who}: the key certificate is for a different passkey.`);
      }
      if (opts.authorityPublicKey && cert.authorityPublicKey !== opts.authorityPublicKey) {
        errors.push(`${who}: the key certificate was issued by a different authority.`);
      }
      const crypto = opts.crypto ?? defaultCryptoProvider;
      if (!(await crypto.verify(canonicalizeJson(s), cert.signature, cert.authorityPublicKey))) {
        errors.push(`${who}: the key certificate's signature is invalid.`);
      }
    } else if (opts.requireCertificate) {
      errors.push(`${who}: the passkey isn't certified as theirs.`);
    }
  } catch (err) {
    errors.push(`${who}: personal signature could not be read (${(err as Error).message}).`);
  }
  return { valid: errors.length === 0, errors };
}

/** Signs a key certificate with the lock authority's key. */
export async function issueKeyCertificate(
  statement: KeyCertificateStatement,
  authority: { privateKey: string; publicKey: string },
  crypto: CryptoProvider = defaultCryptoProvider
): Promise<KeyCertificate> {
  return { statement, signature: await crypto.sign(canonicalizeJson(statement), authority.privateKey), authorityPublicKey: authority.publicKey };
}
