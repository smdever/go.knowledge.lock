/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) Implementation
 * Zero external dependencies. Ensures deterministic byte serialization
 * for cryptographic hashing and signatures across different runtimes.
 */

export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    // Primitives
    if (typeof obj === "number" && !Number.isFinite(obj)) {
      return "null";
    }
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const elements = obj.map((item) => {
      const canonicalItem = canonicalizeJson(item);
      return canonicalItem === undefined ? "null" : canonicalItem;
    });
    return `[${elements.join(",")}]`;
  }

  // Object: sort keys by UTF-16 code unit order (standard string comparison)
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const value = (obj as Record<string, unknown>)[key];
    if (value === undefined || typeof value === "symbol" || typeof value === "function") {
      continue;
    }
    const serializedValue = canonicalizeJson(value);
    if (serializedValue !== undefined) {
      entries.push(`${JSON.stringify(key)}:${serializedValue}`);
    }
  }

  return `{${entries.join(",")}}`;
}
