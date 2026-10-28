/**
 * What a linked page's label says (R3) and what the panel offers (R4, R10, R11). Kept free of Forge imports so it
 * can be tested on its own.
 */

/** The record, as the Knowledge Lock API's display summary describes it. */
export interface RecordSummary {
  lockId: string;
  title: string;
  version: number;
  lockedAt: string;
  valid: boolean;
  url: string;
  signedOffBy: { name: string; at: string; passkey: boolean }[];
  newest: { lockId: string; version: number; url: string } | null;
  retired: { retiredAt: string; retiredBy: string; reason: string } | null;
}

/** Why Knowledge Lock couldn't give us the record. Each maps to a plain explanation and who can fix it. */
export type Problem = "not_configured" | "invalid_key" | "not_found" | "rate_limited" | "unreachable";

export type RecordState =
  | { kind: "record"; record: RecordSummary }
  | { kind: "closing"; message: string }
  | { kind: "problem"; problem: Problem; message?: string };

/** The only labels a linked page can show, exactly as R3 lists them. */
export function labelFor(state: RecordState): string {
  if (state.kind === "closing") return "Organisation closing";
  if (state.kind === "problem") return "Can't reach Knowledge Lock";
  const r = state.record;
  if (r.retired) return "Retired";
  if (r.newest) return `Newer version available (v${r.newest.version})`;
  return `Locked v${r.version}`;
}

/** The drift check is offered only for a record that's in use: not retired, not closing, and still verifying (R10). */
export function canCheck(state: RecordState): boolean {
  return state.kind === "record" && !state.record.retired && state.record.valid;
}

/** Plain-words explanation of a problem, saying who can fix it (R11). */
export function explain(problem: Problem): { title: string; text: string } {
  switch (problem) {
    case "not_configured":
      return {
        title: "Knowledge Lock isn't connected to this site",
        text: "A Confluence administrator can connect it in the Knowledge Lock app's settings, using an API key from Knowledge Lock.",
      };
    case "invalid_key":
      return {
        title: "The connection to Knowledge Lock has stopped working",
        text: "The API key this site uses may have been revoked. A Confluence administrator can add a new key in the Knowledge Lock app's settings. An owner in Knowledge Lock can create one on the API keys page.",
      };
    case "not_found":
      return {
        title: "This record wasn't found",
        text: "It isn't in the Knowledge Lock organisation this site is connected to. An editor of this page can link it to a different record.",
      };
    case "rate_limited":
      return {
        title: "Knowledge Lock is busy",
        text: "This site has made a lot of requests in the last hour. Try again later. If it keeps happening, tell your Confluence administrator.",
      };
    case "unreachable":
      return {
        title: "Knowledge Lock couldn't be reached",
        text: "This is usually temporary. Try again in a few minutes. The page itself works as normal.",
      };
  }
}

const LOCK_ID = /^0x[0-9a-f]{64}$/i;

/** Accepts a record link copied from Knowledge Lock, or a bare lock ID (R2). */
export function lockIdFrom(input: string): string | null {
  const text = input.trim();
  if (LOCK_ID.test(text)) return text.toLowerCase();
  try {
    const url = new URL(text);
    const id = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return LOCK_ID.test(id) && /\/l\//.test(url.pathname) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

export const MAX_CHECK_CHARS = 4000;

/** What the drift check sends: the page text, cut to the length Knowledge Lock checks, and whether it was cut. */
export function textToCheck(text: string): { work: string; truncated: boolean } {
  const clean = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > MAX_CHECK_CHARS ? { work: clean.slice(0, MAX_CHECK_CHARS), truncated: true } : { work: clean, truncated: false };
}
