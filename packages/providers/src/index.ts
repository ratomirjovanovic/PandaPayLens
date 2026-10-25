/**
 * Full adapter registry. In the web app this is only loaded inside the
 * analysis Web Worker, so adapters and catalogs stay out of page bundles.
 */
import type { ProviderAdapter } from "@pandapaylens/core";
import { adyenAdapter } from "@pandapaylens/adyen";
import { stripeAdapter } from "@pandapaylens/stripe";

export const ADAPTERS: readonly ProviderAdapter<any>[] = [stripeAdapter, adyenAdapter];

export { MANIFESTS, ROADMAP, manifestFor, type RoadmapEntry } from "./manifests.js";
