/**
 * Deployment edition.
 *
 * - "cloud" (default) — the multi-tenant SaaS we operate: platform-owner admin
 *   console, customer onboarding, trials, plans, and seat caps are all on.
 * - "self-hosted" — a single-tenant build shipped to a licensed customer: the
 *   operator-only surface (the /admin console + cross-tenant account APIs) is
 *   blocked, trials are off, and seats are uncapped (perpetual license).
 *
 * Set NEXT_PUBLIC_DEPLOYMENT_MODE at build time (it's inlined into the client
 * bundle). Unset ⇒ "cloud", so existing cloud deploys are unaffected.
 */
export type DeploymentMode = "cloud" | "self-hosted";

export const DEPLOYMENT_MODE: DeploymentMode =
  process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "self-hosted" ? "self-hosted" : "cloud";

export const isSelfHosted = DEPLOYMENT_MODE === "self-hosted";
export const isCloud = !isSelfHosted;
