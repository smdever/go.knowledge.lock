/**
 * One codebase, two deployments. KL_MODE=app runs the product (sign-in, organisations, real sign-off);
 * anything else runs the public demo. The proxy hides each mode's routes from the other.
 */
export const isAppMode = () => process.env.KL_MODE === "app";

/** Public address of the product, used in sign-in and invite links. */
export function appUrl(): string {
  return (process.env.KL_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
