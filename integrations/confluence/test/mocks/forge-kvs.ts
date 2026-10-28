/** Test stand-in for @forge/kvs: in memory, with separate secret storage. */
export const store = new Map<string, unknown>();
export const secrets = new Map<string, unknown>();
export const kvs = {
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  delete: async (k: string) => void store.delete(k),
  getSecret: async (k: string) => secrets.get(k),
  setSecret: async (k: string, v: unknown) => void secrets.set(k, v),
  deleteSecret: async (k: string) => void secrets.delete(k),
};
export default kvs;
