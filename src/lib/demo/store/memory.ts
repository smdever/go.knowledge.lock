import type { KnowledgeLockBlock } from "@/lib/protocol";
import type { DemoRecord } from "../types";
import type { Store } from "./types";

interface MemoryState {
  records: Map<string, DemoRecord>;
  locks: Map<string, KnowledgeLockBlock>;
  supersessions: Map<string, string>;
  usage: Map<string, number>;
}

const g = globalThis as unknown as { __klMemory?: MemoryState };

function state(): MemoryState {
  if (!g.__klMemory) {
    g.__klMemory = { records: new Map(), locks: new Map(), supersessions: new Map(), usage: new Map() };
  }
  return g.__klMemory;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Local development store. Data is lost on restart and is not shared between server instances. */
export const memoryStore: Store = {
  async getRecord(id) {
    const r = state().records.get(id);
    return r ? clone(r) : null;
  },
  async saveRecord(record) {
    state().records.set(record.id, clone(record));
  },
  async insertLock(block) {
    if (state().locks.has(block.lockId)) throw new Error(`Lock ${block.lockId} already exists`);
    state().locks.set(block.lockId, clone(block));
  },
  async getLock(lockId) {
    const b = state().locks.get(lockId);
    return b ? clone(b) : null;
  },
  async insertSupersession(lockId, supersededBy) {
    if (state().supersessions.has(lockId)) throw new Error(`Lock ${lockId} is already superseded`);
    state().supersessions.set(lockId, supersededBy);
  },
  async getSupersededBy(lockId) {
    return state().supersessions.get(lockId) ?? null;
  },
  async incrementUsage(key, amount) {
    const next = (state().usage.get(key) ?? 0) + amount;
    state().usage.set(key, next);
    return next;
  },
};
