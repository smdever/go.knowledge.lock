import { memoryStore } from "./memory";
import { postgresStore } from "./postgres";
import type { Store } from "./types";

export type { Store } from "./types";

/** Postgres when DATABASE_URL is set, otherwise an in-memory store for local development. */
export function getStore(): Store {
  return process.env.DATABASE_URL ? postgresStore : memoryStore;
}

export function usingDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
