/**
 * One codebase, two deployments. KL_MODE=app runs the product (sign-in, organisations, real sign-off);
 * anything else runs the public demo. The proxy hides each mode's routes from the other.
 */
export const isAppMode = () => process.env.KL_MODE === "app";

/**
 * Public address of the product, used in sign-in and invite links: KL_APP_URL, else the project's
 * production domain on Vercel, else localhost for local development.
 */
export function appUrl(): string {
  const explicit = process.env.KL_APP_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (explicit || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}
