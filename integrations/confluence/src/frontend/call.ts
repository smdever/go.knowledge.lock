import { invoke } from "@forge/bridge";

export type Err = { error: string };
export const isErr = (x: unknown): x is Err => typeof x === "object" && x !== null && "error" in x;

/** Calls a backend resolver. Resolvers return `{ error }` in plain words rather than throwing. */
export async function call<T>(name: string, payload?: Record<string, unknown>): Promise<T | Err> {
  try {
    return (await invoke(name, payload)) as T | Err;
  } catch {
    return { error: "The app couldn't respond. Reload the page and try again." };
  }
}
