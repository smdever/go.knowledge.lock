/**
 * Runs the app's backend against a local Knowledge Lock server, with Confluence and Forge storage faked.
 * Setup (a locked record and an API key) is written to KL_TEST_SETUP by the test harness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { bylineProps, handler } from "../src/index";
import { calls, confluence } from "./mocks/forge-api";
import { secrets, store } from "./mocks/forge-kvs";

const setup = JSON.parse(readFileSync(process.env.KL_TEST_SETUP!, "utf8")) as { key: string; lockId: string };
const page = { extension: { content: { id: "98765", type: "page" } }, siteUrl: "https://harbour.atlassian.net", moduleKey: "kl-byline" };
const settings = { moduleKey: "kl-settings" };
const run = (functionKey: string, payload?: unknown, context: object = page) => handler({ call: { functionKey, payload }, context } as never) as Promise<any>;
const label = async () => (await bylineProps({ extension: page.extension })).title;
const app = (path: string, data: unknown) => fetch(`${process.env.KL_TEST_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: process.env.KL_TEST_COOKIE! }, body: JSON.stringify(data) }).then((r) => r.json() as Promise<any>);
const fresh = () => [...store.keys()].filter((k) => k.startsWith("status:")).forEach((k) => store.delete(k));

const adf = (...lines: string[]) => JSON.stringify({ type: "doc", content: lines.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })) });
confluence.page.body.atlas_doc_format.value = adf("The bot greets customers and says it is an AI assistant.", "Customers can log a complaint.");

test("R1: settings refuse other modules, reject bad keys, and keep the key out of every response", async () => {
  assert.match((await run("settingsSave", { key: setup.key }, page)).error, /settings page/);
  assert.match((await run("settingsSave", { key: "nope" }, settings)).error, /starts with kl_live_/);
  assert.match((await run("settingsSave", { key: "kl_live_" + "x".repeat(30) }, settings)).error, /didn't accept that key/);
  assert.equal(secrets.size, 0);
  const saved = await run("settingsSave", { key: setup.key }, settings);
  assert.deepEqual(saved, { configured: true });
  assert.equal(secrets.get("kl-api-key"), setup.key);
  assert.ok(!JSON.stringify(await run("settingsLoad", undefined, settings)).includes("kl_live_"));
});

test("R2: unlinked page; only editors can link; bad links explained", async () => {
  assert.equal(await label(), "Knowledge Lock");
  assert.equal((await run("load")).linked, false);
  confluence.canEdit = false;
  assert.match((await run("link", { link: setup.lockId })).error, /Only people who can edit/);
  confluence.canEdit = true;
  assert.match((await run("link", { link: "https://example.com/x" })).error, /Paste the link/);
  assert.match((await run("link", { link: "0x" + "0".repeat(64) })).error, /wasn't found/);
  assert.deepEqual(await run("link", { link: `https://app.knowledge-lock.com/app/l/${setup.lockId}` }), { ok: true });
});

test("R3, R4: label and panel for a locked record, signers by name only", async () => {
  assert.equal(await label(), "Locked v1");
  const l = await run("load");
  assert.equal(l.label, "Locked v1");
  assert.equal(l.canCheck, true);
  assert.equal(l.state.record.title, "Complaints assistant: requirements");
  assert.equal(l.state.record.signedOffBy[0].name, "Olivia Ward, Head of Delivery");
  assert.ok(!JSON.stringify(l).includes("@harbour.test"));
  assert.match(l.state.record.url, /\/app\/l\/0x/);
});

test("R5 to R8: check on request only, findings shaped, no page text kept, check logged", async () => {
  const before = calls.filter((c) => c.url.endsWith("/check")).length;
  await run("load");
  await label();
  assert.equal(calls.filter((c) => c.url.endsWith("/check")).length, before, "nothing sent without the button");
  const r = await run("check");
  assert.ok(Array.isArray(r.findings), JSON.stringify(r));
  assert.equal(r.truncated, false);
  const sent = JSON.parse(calls.filter((c) => c.url.endsWith("/check")).pop()!.body!);
  assert.match(sent.work, /^Complaints assistant design\n\nThe bot greets/);
  assert.deepEqual(sent.source, { kind: "confluence", site: "https://harbour.atlassian.net" });
  assert.ok(![...store.values()].some((v) => JSON.stringify(v).includes("The bot greets")), "page text not stored by the app");
  confluence.page.body.atlas_doc_format.value = adf("y".repeat(5000));
  assert.equal((await run("check")).truncated, true);
  confluence.page.body.atlas_doc_format.value = adf("The bot greets customers and says it is an AI assistant.");
});

test("R3: newer version available", async () => {
  const draft = await app("/api/app/records", { parentLockId: setup.lockId });
  const id = draft.record.id;
  await app(`/api/app/records/${id}/review`, {});
  await app(`/api/app/records/${id}/approve`, { decision: "APPROVE" });
  const locked = await app(`/api/app/records/${id}/lock`, {});
  assert.ok(locked.lockId || locked.ok !== false, JSON.stringify(locked).slice(0, 200));
  fresh();
  assert.equal(await label(), "Newer version available (v2)");
  const l = await run("load");
  assert.equal(l.state.record.newest.version, 2);
  assert.equal(l.canCheck, true);
  process.env.KL_TEST_V2 = l.state.record.newest.lockId;
});

test("R10: retired — label says so, no check offered or allowed", async () => {
  const r = await app(`/api/app/locks/${process.env.KL_TEST_V2}/retire`, { reason: "Withdrawn in October" });
  assert.ok(!r.error, JSON.stringify(r));
  fresh();
  assert.equal(await label(), "Retired");
  const l = await run("load");
  assert.equal(l.canCheck, false);
  assert.equal(l.state.record.retired.reason, "Withdrawn in October");
  assert.match((await run("check")).error, /retired/);
  assert.match((await run("link", { link: process.env.KL_TEST_V2 })).error, /retired/);
});

test("R11: revoked or missing key — page still loads, plain explanation", async () => {
  secrets.set("kl-api-key", "kl_live_" + "z".repeat(30));
  fresh();
  assert.equal(await label(), "Can't reach Knowledge Lock");
  const l = await run("load");
  assert.equal(l.state.problem, "invalid_key");
  assert.equal(l.canCheck, false);
  process.env.KL_TEST_BASE_SAVED = process.env.KL_TEST_BASE;
  process.env.KL_TEST_BASE = "http://localhost:1";
  secrets.set("kl-api-key", setup.key);
  fresh();
  assert.equal((await run("load")).state.problem, "unreachable");
  process.env.KL_TEST_BASE = process.env.KL_TEST_BASE_SAVED;
  await run("settingsRemove", undefined, settings);
  fresh();
  assert.equal((await run("load")).state.problem, "not_configured");
  secrets.set("kl-api-key", setup.key);
});

test("R9: the app only reads from Confluence and only calls Knowledge Lock's read and check endpoints", () => {
  const kl = calls.map((c) => new URL(c.url));
  assert.ok(kl.every((u) => u.origin === "https://app.knowledge-lock.com"));
  assert.ok(kl.every((u) => /^\/api\/v1\/locks(\/0x[0-9a-f]+(\/check)?)?$/.test(u.pathname)), kl.map((u) => u.pathname).join(" "));
});

test("R10: organisation closing — label says so, no check", async () => {
  const sql = (q: string) => execSync(`psql "${process.env.KL_TEST_DB}" -qc "${q}"`);
  sql("UPDATE kl_organisations SET closing_at=now(), closing_by_name='Olivia Ward', delete_after=now()+interval '30 days'");
  try {
    fresh();
    assert.equal(await label(), "Organisation closing");
    const l = await run("load");
    assert.equal(l.canCheck, false);
    assert.match(l.state.message, /closing/);
    assert.match((await run("check")).error, /closing/);
  } finally {
    sql("UPDATE kl_organisations SET closing_at=NULL, closing_by_name=NULL, delete_after=NULL");
    fresh();
  }
});

test("unlink, for editors only", async () => {
  confluence.canEdit = false;
  assert.match((await run("unlink")).error, /Only people who can edit/);
  confluence.canEdit = true;
  assert.deepEqual(await run("unlink"), { ok: true });
  assert.equal(await label(), "Knowledge Lock");
});
