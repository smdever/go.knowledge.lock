/** Test stand-in for @forge/api: Knowledge Lock calls go to a local server, Confluence calls to a fake page. */
export const calls: { url: string; body?: string }[] = [];
export const confluence = {
  canEdit: true,
  page: { title: "Complaints assistant design", body: { atlas_doc_format: { value: "" } } } as any,
};
const target = () => process.env.KL_TEST_BASE ?? "http://localhost:3300";

export async function fetch(url: string, init: any = {}) {
  const local = url.replace("https://app.knowledge-lock.com", target());
  calls.push({ url, body: init.body });
  return globalThis.fetch(local, init);
}

export const route = (strings: TemplateStringsArray, ...values: unknown[]) =>
  strings.reduce((s, str, i) => s + str + (i < values.length ? encodeURIComponent(String(values[i])) : ""), "");

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const api = {
  asUser: () => ({
    requestConfluence: async (path: string) => {
      if (path.endsWith("/operations")) return json(200, { operations: confluence.canEdit ? [{ operation: "read" }, { operation: "update", targetType: "page" }] : [{ operation: "read" }] });
      if (path.includes("body-format=atlas_doc_format")) return json(200, confluence.page);
      return json(404, {});
    },
  }),
};
export default api;
