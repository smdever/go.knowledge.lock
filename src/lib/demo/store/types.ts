import type { KnowledgeLockBlock } from "@/lib/protocol";
import type { DemoRecord } from "../types";

export interface Store {
  getRecord(id: string): Promise<DemoRecord | null>;
  saveRecord(record: DemoRecord): Promise<void>;
  /** Append-only: throws if a lock with this id already exists. */
  insertLock(block: KnowledgeLockBlock, recordId: string | null): Promise<void>;
  getLock(lockId: string): Promise<KnowledgeLockBlock | null>;
  /** Append-only link from an old lock to the lock that replaced it. */
  insertSupersession(lockId: string, supersededBy: string): Promise<void>;
  getSupersededBy(lockId: string): Promise<string | null>;
  /** Adds `amount` to a usage counter and returns the new total. */
  incrementUsage(key: string, amount: number): Promise<number>;
}
