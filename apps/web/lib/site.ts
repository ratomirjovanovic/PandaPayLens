export const SITE_NAME = "PandaPayLens";
export const SITE_TAGLINE =
  "Decode payment errors. Visualize transaction events. Understand what went wrong.";
export const SITE_DESCRIPTION =
  "Open-source, local-first payment debugging tool. Decode Stripe and Adyen errors, rebuild webhook event timelines, and find duplicate or out-of-order deliveries. Your data never leaves your browser.";
export const REPO_URL = "https://github.com/ratomirjovanovic/PandaPayLens";
export const MAINTAINER_URL = "https://github.com/ratomirjovanovic";

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL in deployments; self-hosters use their own. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const APP_VERSION = "0.1.0";
