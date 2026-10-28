import Resolver from "@forge/resolver";
import { kvs } from "@forge/kvs";
import { canEdit, contentFrom, pageText, siteFrom, type Content } from "./lib/confluence";
import { checkDrift, forgetState, getKey, recordState, removeKey, saveKey, testKey } from "./lib/kl";
import { canCheck, explain, labelFor, lockIdFrom, textToCheck, type RecordState } from "./lib/status";

/**
 * Which record a page is linked to is kept in the app's own Forge storage, not in Confluence, so the app never
 * needs permission to change Confluence content (R9, R13). Only the record's ID is kept, not who linked it.
 */
const linkKey = (c: Content) => `link:${c.type}:${c.id}`;
const linkedTo = async (c: Content) => (await kvs.get<{ lockId: string }>(linkKey(c)))?.lockId ?? null;

class UserError extends Error {}
const fail = (message: string): never => {
  throw new UserError(message);
};

/** Resolver errors come back to the panel as `{ error }`, in plain words. */
async function safely<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    console.error("[knowledge-lock] resolver", err);
    return { error: "Something went wrong. Please try again." };
  }
}

function contentOrFail(context: Record<string, any>): Content {
  return contentFrom(context) ?? fail("This only works on a Confluence page or blog post.");
}

// ---------- The label near the title (R3) ----------

/** Sets the byline item's text for each page view. Unlinked pages show the app's name so editors can find it. */
export async function bylineProps(payload: Record<string, any>) {
  try {
    const content = contentFrom(payload) ?? contentFrom(payload?.context);
    const lockId = content ? await linkedTo(content) : null;
    if (!lockId) return { title: "Knowledge Lock", tooltip: "Link this page to a locked record in Knowledge Lock" };
    const state = await recordState(lockId);
    return { title: labelFor(state), tooltip: tooltipFor(state) };
  } catch (err) {
    console.error("[knowledge-lock] byline", err);
    return { title: "Can't reach Knowledge Lock", tooltip: "Open for details" };
  }
}

function tooltipFor(state: RecordState): string {
  if (state.kind === "record") return `${state.record.title}. Open to see who signed it off and check this page for drift.`;
  if (state.kind === "closing") return "The Knowledge Lock organisation behind this record is closing. Open for details.";
  return explain(state.problem).title;
}

// ---------- The panel (R2, R4 to R11) ----------

const resolver = new Resolver();

resolver.define("load", async ({ context }) =>
  safely(async () => {
    const content = contentOrFail(context);
    const [lockId, editor, key] = await Promise.all([linkedTo(content), canEdit(content).catch(() => false), getKey()]);
    if (!lockId) return { linked: false as const, canEdit: editor, configured: Boolean(key) };
    const state = await recordState(lockId);
    return { linked: true as const, lockId, canEdit: editor, configured: Boolean(key), state, label: labelFor(state), canCheck: canCheck(state) };
  })
);

resolver.define("link", async ({ payload, context }) =>
  safely(async () => {
    const content = contentOrFail(context);
    if (!(await canEdit(content))) fail("Only people who can edit this page can link it to a record.");
    if (!(await getKey())) fail(explain("not_configured").text);
    const lockId = lockIdFrom(String(payload?.link ?? "")) ?? fail("Paste the link to a locked record. It looks like https://app.knowledge-lock.com/app/l/0x…");
    const state = await recordState(lockId, { fresh: true });
    if (state.kind === "problem") fail(`${explain(state.problem).title}. ${explain(state.problem).text}`);
    if (state.kind === "closing") fail("The Knowledge Lock organisation this site is connected to is closing, so pages can't be linked to its records.");
    if (state.kind === "record" && state.record.retired) fail("That record has been retired, so it isn't the signed-off version any more. Link the page to the record that replaced it.");
    await kvs.set(linkKey(content), { lockId });
    return { ok: true };
  })
);

resolver.define("unlink", async ({ context }) =>
  safely(async () => {
    const content = contentOrFail(context);
    if (!(await canEdit(content))) fail("Only people who can edit this page can remove its link.");
    await kvs.delete(linkKey(content));
    return { ok: true };
  })
);

resolver.define("refresh", async ({ context }) =>
  safely(async () => {
    const lockId = await linkedTo(contentOrFail(context));
    if (lockId) await forgetState(lockId);
    return { ok: true };
  })
);

/** The drift check runs only when someone presses the button (R7), and only for a record that's in use (R10). */
resolver.define("check", async ({ context }) =>
  safely(async () => {
    const content = contentOrFail(context);
    const lockId = (await linkedTo(content)) ?? fail("This page isn't linked to a record.");
    const state = await recordState(lockId, { fresh: true });
    if (!canCheck(state)) {
      fail(
        state.kind === "closing"
          ? "The Knowledge Lock organisation is closing, so pages can't be checked."
          : state.kind === "problem"
            ? `${explain(state.problem).title}. ${explain(state.problem).text}`
            : state.record.retired
              ? "This record has been retired, so pages aren't checked against it."
              : "This record failed verification in Knowledge Lock, so pages aren't checked against it."
      );
    }
    const page = (await pageText(content)) ?? fail("The page couldn't be read. Try again in a moment.");
    const { work, truncated } = textToCheck(page.text);
    if (!work) fail("This page has no text to check yet.");
    const result = await checkDrift(lockId, work, siteFrom(context));
    if (!result.ok) {
      await forgetState(lockId);
      if ("closing" in result) fail("The Knowledge Lock organisation is closing, so pages can't be checked.");
      if ("retired" in result) fail("This record has just been retired, so pages aren't checked against it.");
      const p = explain(result.problem ?? "unreachable");
      fail(`${p.title}. ${p.text}`);
    }
    return { summary: result.summary, findings: result.findings, truncated, checkedAt: new Date().toISOString() };
  })
);

// ---------- Settings, for Confluence administrators (R1) ----------

/** Confluence shows the settings page only to site administrators. Its resolvers also refuse calls from any other module. */
const SETTINGS_MODULE = "kl-settings";
const fromSettings = (context: Record<string, any>) => context?.moduleKey === SETTINGS_MODULE || fail("Only the app's settings page can do this.");

resolver.define("settingsLoad", async ({ context }) =>
  safely(async () => {
    fromSettings(context);
    return { configured: Boolean(await getKey()) };
  })
);

resolver.define("settingsSave", async ({ payload, context }) =>
  safely(async () => {
    fromSettings(context);
    const key = String(payload?.key ?? "").trim();
    if (!/^kl_live_[A-Za-z0-9_-]{16,}$/.test(key)) fail("That doesn't look like a Knowledge Lock API key. It starts with kl_live_.");
    const test = await testKey(key);
    if (!test.ok) {
      fail(
        test.problem === "closing"
          ? "That key belongs to a Knowledge Lock organisation that is closing, so it can't be used."
          : test.problem === "invalid_key"
            ? "Knowledge Lock didn't accept that key. Check it was copied in full and hasn't been revoked."
            : `${explain(test.problem).title}. ${explain(test.problem).text}`
      );
    }
    await saveKey(key);
    return { configured: true };
  })
);

resolver.define("settingsRemove", async ({ context }) =>
  safely(async () => {
    fromSettings(context);
    await removeKey();
    return { configured: false };
  })
);

export const handler = resolver.getDefinitions();
