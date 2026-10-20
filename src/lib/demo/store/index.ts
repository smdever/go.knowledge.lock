import { memoryStore } from "./memory";
import { databaseUrl, postgresStore } from "./postgres";
import type { Store } from "./types";

export type { Store } from "./types";

/** Postgres when DATABASE_URL (or POSTGRES_URL) is set, otherwise an in-memory store for local development. */
export function getStore(): Store {
  return databaseUrl() ? postgresStore : memoryStore;
}

export function usingDatabase(): boolean {
  return Boolean(databaseUrl());
}
