/**
 * Full adapter registry. In the web app this is only loaded inside the
 * analysis Web Worker, so adapters and catalogs stay out of page bundles.
 */
import type { ProviderAdapter } from "@pandapaylens/core";
import { stripeAdapter } from "@pandapaylens/stripe";
import { adyenAdapter } from "@pandapaylens/adyen";
import { payablAdapter } from "@pandapaylens/payabl";
import { braintreeAdapter } from "@pandapaylens/braintree";
import { checkoutAdapter } from "@pandapaylens/checkout";
import { paypalAdapter } from "@pandapaylens/paypal";
import { mollieAdapter } from "@pandapaylens/mollie";
import { squareAdapter } from "@pandapaylens/square";
import { ccbillAdapter } from "@pandapaylens/ccbill";
import { segpayAdapter } from "@pandapaylens/segpay";
import { trustPaymentsAdapter } from "@pandapaylens/trust-payments";
import { pxpAdapter } from "@pandapaylens/pxp";
import { verotelAdapter } from "@pandapaylens/verotel";
import { netbillingAdapter } from "@pandapaylens/netbilling";

export const ADAPTERS: readonly ProviderAdapter<any>[] = [
  stripeAdapter,
  adyenAdapter,
  payablAdapter,
  checkoutAdapter,
  braintreeAdapter,
  paypalAdapter,
  mollieAdapter,
  squareAdapter,
  ccbillAdapter,
  segpayAdapter,
  trustPaymentsAdapter,
  pxpAdapter,
  verotelAdapter,
  netbillingAdapter,
];

export {
  MANIFESTS,
  ROADMAP,
  manifestFor,
  type RoadmapEntry,
  type RoadmapFocus,
} from "./manifests.js";
