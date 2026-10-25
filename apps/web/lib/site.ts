export const SITE_NAME = "PandaPayLens";
export const SITE_TAGLINE =
  "Decode payment errors. Visualize transaction events. Understand what went wrong.";
/** Path prefix when served from a sub-path (GitHub Pages project site). */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** True in the static GitHub Pages build: no server, no admin. */
export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

export const PAGES_DEMO_URL = "https://ratomirjovanovic.github.io/PandaPayLens/";

export const SITE_DESCRIPTION =
  "Debug payment errors, inspect webhook events, and visualize transaction timelines with PandaPayLens. Free, open-source and local-first.";
export const REPO_URL = "https://github.com/ratomirjovanovic/PandaPayLens";
export const MAINTAINER_URL = "https://github.com/ratomirjovanovic";

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL in deployments; self-hosters use their own. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const APP_VERSION = "0.6.0";
