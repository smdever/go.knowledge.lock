import type { ProviderId, Resolution } from "./demo/types";

/**
 * Compares two versions of a record's wording, line by line, for the sign-off step. Lines that are the
 * same are matched first; the rest are paired as rewordings when a recorded fix says so or the words
 * mostly overlap, and otherwise shown as removed or added.
 */
export interface Claim {
  id: string;
  statement: string;
}

export interface WordPart {
  type: "same" | "del" | "ins";
  text: string;
}

export interface Why {
  raisedBy: ProviderId[];
  issues: { provider: ProviderId; detail: string; policyRef?: string }[];
  /** Set when the wording being signed is exactly what a reviewer suggested. */
  suggestedBy?: ProviderId;
}

export type LineChange =
  | { kind: "unchanged"; id: string; statement: string }
  | { kind: "reworded"; fromId: string; toId: string; from: string; to: string; words: WordPart[]; why?: Why }
  | { kind: "removed"; id: string; statement: string; why?: Why }
  | { kind: "added"; id: string; statement: string };

/** Longest common subsequence as a list of operations, for short sequences (lines or words). */
function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): ("same" | "del" | "ins")[] {
  const m = a.length;
  const n = b.length;
  const t: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = eq(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const ops: ("same" | "del" | "ins")[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (eq(a[i], b[j])) {
      ops.push("same");
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) {
      ops.push("del");
      i++;
    } else {
      ops.push("ins");
      j++;
    }
  }
  while (i++ < m) ops.push("del");
  while (j++ < n) ops.push("ins");
  return ops;
}

/** Words with their trailing space, so spaces never count as a match on their own. */
const tokens = (s: string) => s.match(/\s*\S+\s*/g) ?? [];
const words = (s: string) => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2));

/** How much two lines share, from 0 to 1. */
function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

/** Word-level changes within a reworded line. Changes between two unchanged stretches read as one replacement. */
export function wordDiff(from: string, to: string): WordPart[] {
  const a = tokens(from);
  const b = tokens(to);
  const ops = lcs(a, b, (x, y) => x.trim() === y.trim());
  const parts: WordPart[] = [];
  let del = "";
  let ins = "";
  const flush = () => {
    if (del) parts.push({ type: "del", text: del });
    if (ins) parts.push({ type: "ins", text: ins });
    del = "";
    ins = "";
  };
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === "same") {
      flush();
      const text = b[j];
      const last = parts[parts.length - 1];
      if (last?.type === "same") last.text += text;
      else parts.push({ type: "same", text });
      i++;
      j++;
    } else if (op === "del") del += a[i++];
    else ins += b[j++];
  }
  flush();
  return parts;
}

function whyFor(from: string, to: string | undefined, resolutions: Resolution[]): Why | undefined {
  const r = [...resolutions].reverse().find((x) => x.originalStatement === from);
  if (!r) return undefined;
  return {
    raisedBy: r.raisedBy,
    issues: r.issues.map((i) => ({ provider: i.provider, detail: i.detail, ...(i.policyRef ? { policyRef: i.policyRef } : {}) })),
    ...(r.suggestedBy && to !== undefined && r.newStatement === to ? { suggestedBy: r.suggestedBy } : {}),
  };
}

const REWORD_THRESHOLD = 0.3;

export function compareWording(before: Claim[], after: Claim[], resolutions: Resolution[] = []): LineChange[] {
  const ops = lcs(before, after, (x, y) => x.statement === y.statement);
  const out: LineChange[] = [];
  let i = 0;
  let j = 0;
  let dels: Claim[] = [];
  let ins: Claim[] = [];

  const flush = () => {
    const used = new Set<number>();
    for (const d of dels) {
      // A recorded fix pairs lines exactly; otherwise take the most similar unused line.
      let best = ins.findIndex((a, k) => !used.has(k) && resolutions.some((r) => r.originalStatement === d.statement && r.newStatement === a.statement));
      if (best < 0) {
        let score = REWORD_THRESHOLD;
        ins.forEach((a, k) => {
          const s = used.has(k) ? 0 : similarity(d.statement, a.statement);
          if (s >= score) {
            score = s;
            best = k;
          }
        });
      }
      if (best >= 0) {
        used.add(best);
        const a = ins[best];
        out.push({
          kind: "reworded",
          fromId: d.id,
          toId: a.id,
          from: d.statement,
          to: a.statement,
          words: wordDiff(d.statement, a.statement),
          why: whyFor(d.statement, a.statement, resolutions),
        });
      } else {
        out.push({ kind: "removed", id: d.id, statement: d.statement, why: whyFor(d.statement, undefined, resolutions) });
      }
    }
    ins.forEach((a, k) => {
      if (!used.has(k)) out.push({ kind: "added", id: a.id, statement: a.statement });
    });
    dels = [];
    ins = [];
  };

  for (const op of ops) {
    if (op === "same") {
      flush();
      out.push({ kind: "unchanged", id: after[j].id, statement: after[j].statement });
      i++;
      j++;
    } else if (op === "del") dels.push(before[i++]);
    else ins.push(after[j++]);
  }
  flush();
  return out;
}

/** Without a saved baseline (drafts started before comparisons existed), only the recorded fixes can be shown. */
export function changesFromResolutions(resolutions: Resolution[], current: Claim[]): LineChange[] {
  const now = new Set(current.map((c) => c.statement));
  return resolutions.map((r): LineChange =>
    r.outcome === "reworded" && r.newStatement
      ? {
          kind: "reworded",
          fromId: r.requirementId,
          toId: current.find((c) => c.statement === r.newStatement)?.id ?? r.requirementId,
          from: r.originalStatement,
          to: r.newStatement,
          words: wordDiff(r.originalStatement, r.newStatement),
          why: whyFor(r.originalStatement, now.has(r.newStatement) ? r.newStatement : undefined, [r]),
        }
      : { kind: "removed", id: r.requirementId, statement: r.originalStatement, why: whyFor(r.originalStatement, undefined, [r]) }
  );
}
