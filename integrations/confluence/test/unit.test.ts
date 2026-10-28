import { test } from "node:test";
import assert from "node:assert/strict";
import { adfToText } from "../src/lib/adf";
import { canCheck, labelFor, lockIdFrom, textToCheck, type RecordState, type RecordSummary } from "../src/lib/status";

const rec = (over: Partial<RecordSummary> = {}): RecordState => ({
  kind: "record",
  record: { lockId: "0x1", title: "T", version: 3, lockedAt: "2026-10-28T10:00:00Z", valid: true, url: "u", signedOffBy: [], newest: null, retired: null, ...over },
});

test("R3: only the five labels in the brief", () => {
  assert.equal(labelFor(rec()), "Locked v3");
  assert.equal(labelFor(rec({ newest: { lockId: "0x2", version: 4, url: "u" } })), "Newer version available (v4)");
  assert.equal(labelFor(rec({ retired: { retiredAt: "x", retiredBy: "y", reason: "z" }, newest: { lockId: "0x2", version: 4, url: "u" } })), "Retired");
  assert.equal(labelFor({ kind: "closing", message: "m" }), "Organisation closing");
  for (const p of ["not_configured", "invalid_key", "not_found", "rate_limited", "unreachable"] as const)
    assert.equal(labelFor({ kind: "problem", problem: p }), "Can't reach Knowledge Lock");
});

test("R10: no drift check for retired, closing, unverified or unreachable", () => {
  assert.equal(canCheck(rec()), true);
  assert.equal(canCheck(rec({ newest: { lockId: "0x2", version: 4, url: "u" } })), true);
  assert.equal(canCheck(rec({ retired: { retiredAt: "x", retiredBy: "y", reason: "z" } })), false);
  assert.equal(canCheck(rec({ valid: false })), false);
  assert.equal(canCheck({ kind: "closing", message: "m" }), false);
  assert.equal(canCheck({ kind: "problem", problem: "unreachable" }), false);
});

test("R2: record links and bare IDs", () => {
  const id = "0x" + "ab".repeat(32);
  assert.equal(lockIdFrom(`https://app.knowledge-lock.com/app/l/${id}`), id);
  assert.equal(lockIdFrom(`https://app.knowledge-lock.com/app/l/${id}?tab=build`), id);
  assert.equal(lockIdFrom(`  ${id.toUpperCase().replace("0X", "0x")} `), id);
  assert.equal(lockIdFrom("https://app.knowledge-lock.com/app/r/abc"), null);
  assert.equal(lockIdFrom("nonsense"), null);
});

test("page text from ADF, one line per block", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", content: [{ type: "text", text: "Greeting" }] },
      { type: "paragraph", content: [{ type: "text", text: "The bot says " }, { type: "text", text: "hello", marks: [{ type: "strong" }] }, { type: "text", text: "." }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] }, { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }] }] }] },
    ],
  };
  assert.equal(adfToText(doc), "Greeting\nThe bot says hello.\nOne\nTwo\nA\nB");
  assert.equal(adfToText(null), "");
});

test("long pages are cut to what Knowledge Lock checks, and say so", () => {
  assert.deepEqual(textToCheck("short"), { work: "short", truncated: false });
  const long = textToCheck("x".repeat(5000));
  assert.equal(long.work.length, 4000);
  assert.equal(long.truncated, true);
});
