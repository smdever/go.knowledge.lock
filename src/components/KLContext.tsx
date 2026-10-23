"use client";

import { createContext, useContext } from "react";
import { makeApi, type Api } from "@/lib/demo/client";

/** Where the shared screens send requests and link to: the public demo, or the signed-in product. */
export interface KL {
  mode: "demo" | "app";
  api: Api;
  recordPath: (id: string) => string;
  lockPath: (lockId: string) => string;
}

const DEMO: KL = { mode: "demo", api: makeApi("/api"), recordPath: (id) => `/r/${id}`, lockPath: (id) => `/l/${id}` };
const APP: KL = { mode: "app", api: makeApi("/api/app"), recordPath: (id) => `/app/r/${id}`, lockPath: (id) => `/app/l/${id}` };

const Ctx = createContext<KL>(DEMO);

export const useKL = () => useContext(Ctx);

/** Wrap product pages in this so the shared screens talk to the product's API. */
export function ProductMode({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={APP}>{children}</Ctx.Provider>;
}
