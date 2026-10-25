/**
 * Manifests only: safe to import in pages without pulling in adapter code
 * or error catalogs.
 */
import type { ProviderManifest } from "@pandapaylens/core";
import { stripeManifest } from "@pandapaylens/stripe/manifest";
import { adyenManifest } from "@pandapaylens/adyen/manifest";
import { payablManifest } from "@pandapaylens/payabl/manifest";
import { braintreeManifest } from "@pandapaylens/braintree/manifest";
import { checkoutManifest } from "@pandapaylens/checkout/manifest";
import { paypalManifest } from "@pandapaylens/paypal/manifest";
import { mollieManifest } from "@pandapaylens/mollie/manifest";
import { squareManifest } from "@pandapaylens/square/manifest";

export const MANIFESTS: readonly ProviderManifest[] = [
  stripeManifest,
  adyenManifest,
  payablManifest,
  checkoutManifest,
  braintreeManifest,
  paypalManifest,
  mollieManifest,
  squareManifest,
];

export type RoadmapEntry = { id: string; displayName: string; wave: 0 | 1 | 2 | 3; note?: string };

/**
 * All providers on the roadmap. A provider counts as available only when it
 * has a manifest above; everything else is shown as planned.
 */
export const ROADMAP: readonly RoadmapEntry[] = [
  { id: "stripe", displayName: "Stripe", wave: 0 },
  { id: "adyen", displayName: "Adyen", wave: 0 },
  { id: "payabl", displayName: "payabl.", wave: 1 },
  { id: "checkout", displayName: "Checkout.com", wave: 1 },
  { id: "paypal", displayName: "PayPal", wave: 1 },
  { id: "braintree", displayName: "Braintree", wave: 1 },
  { id: "mollie", displayName: "Mollie", wave: 1 },
  { id: "square", displayName: "Square", wave: 1 },
  {
    id: "worldpay",
    displayName: "Worldpay (Access Worldpay)",
    wave: 2,
    note: "Access Worldpay only; other Worldpay platforms are separate integrations.",
  },
  { id: "cybersource", displayName: "Cybersource", wave: 2 },
  { id: "authorize_net", displayName: "Authorize.net", wave: 2 },
  {
    id: "nuvei",
    displayName: "Nuvei",
    wave: 2,
    note: "API generations and DMN formats are handled as separate families.",
  },
  { id: "paysafe", displayName: "Paysafe", wave: 2 },
  { id: "airwallex", displayName: "Airwallex", wave: 2 },
  { id: "rapyd", displayName: "Rapyd", wave: 2 },
  { id: "dlocal", displayName: "dLocal", wave: 3 },
  { id: "ebanx", displayName: "EBANX", wave: 3 },
  { id: "bluesnap", displayName: "BlueSnap", wave: 3 },
  {
    id: "payu_india",
    displayName: "PayU India",
    wave: 3,
    note: "PayU India only; other PayU regional platforms are separate integrations.",
  },
  { id: "razorpay", displayName: "Razorpay", wave: 3 },
  { id: "paystack", displayName: "Paystack", wave: 3 },
  { id: "flutterwave", displayName: "Flutterwave", wave: 3 },
];

export function manifestFor(id: string): ProviderManifest | undefined {
  return MANIFESTS.find((m) => m.id === id);
}
