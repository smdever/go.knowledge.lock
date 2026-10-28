import api, { route } from "@forge/api";
import { adfToText } from "./adf";

/** The page (or blog post) a module is showing on, from Forge's context. */
export interface Content {
  id: string;
  type: "page" | "blogpost";
}

type Ctx = Record<string, any>;

export function contentFrom(context: Ctx | undefined): Content | null {
  const c = context?.extension?.content ?? context?.context?.extension?.content;
  const id = c?.id ?? context?.contentId ?? context?.context?.contentId;
  if (!id || !/^\d+$/.test(String(id))) return null;
  return { id: String(id), type: c?.type === "blogpost" ? "blogpost" : "page" };
}

/** The site's address, for the check log. Only the https origin is used. */
export function siteFrom(context: Ctx | undefined): string | undefined {
  const raw = context?.siteUrl ?? context?.context?.siteUrl;
  try {
    const url = new URL(String(raw));
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}


/**
 * Whether the person can edit this page, asked as them, so only editors can link or unlink it (R2).
 * Uses Confluence's read-only "operations" endpoint, so no write permission is needed (R13).
 */
export async function canEdit(c: Content): Promise<boolean> {
  const path = c.type === "blogpost" ? route`/wiki/api/v2/blogposts/${c.id}/operations` : route`/wiki/api/v2/pages/${c.id}/operations`;
  const res = await api.asUser().requestConfluence(path, { headers: { Accept: "application/json" } });
  if (!res.ok) return false;
  const json = (await res.json()) as { operations?: { operation?: string; targetType?: string }[] };
  return (json.operations ?? []).some((o) => o.operation === "update");
}

/** The page's current text, read as the person pressing the button, so it's only what they can already see (R5). */
export async function pageText(c: Content): Promise<{ title: string; text: string } | null> {
  const path = c.type === "blogpost" ? route`/wiki/api/v2/blogposts/${c.id}?body-format=atlas_doc_format` : route`/wiki/api/v2/pages/${c.id}?body-format=atlas_doc_format`;
  const res = await api.asUser().requestConfluence(path, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { title?: string; body?: { atlas_doc_format?: { value?: string } } };
  let doc: unknown = null;
  try {
    doc = JSON.parse(json.body?.atlas_doc_format?.value ?? "null");
  } catch {
    doc = null;
  }
  const title = json.title ?? "";
  const body = adfToText(doc);
  return { title, text: [title, body].filter(Boolean).join("\n\n") };
}

