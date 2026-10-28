/** Plain text from a Confluence page body in Atlassian Document Format, one line per paragraph, heading or list item. */
type Node = { type?: string; text?: string; content?: Node[]; attrs?: Record<string, unknown> };

const BLOCKS = new Set(["paragraph", "heading", "listItem", "tableRow", "blockquote", "codeBlock", "panel", "rule", "taskItem", "decisionItem"]);

export function adfToText(doc: unknown): string {
  const out: string[] = [];
  let line = "";
  const end = () => {
    if (line.trim()) out.push(line.trim());
    line = "";
  };
  const walk = (n: Node) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "text" && typeof n.text === "string") line += n.text;
    else if (n.type === "hardBreak") end();
    else if (n.type === "mention" || n.type === "emoji" || n.type === "status") line += String(n.attrs?.text ?? n.attrs?.shortName ?? "");
    else if (n.type === "tableCell" || n.type === "tableHeader") line += line ? " | " : "";
    const block = BLOCKS.has(n.type ?? "");
    if (block) end();
    for (const c of n.content ?? []) walk(c);
    if (block) end();
  };
  walk(doc as Node);
  end();
  return out.join("\n");
}
