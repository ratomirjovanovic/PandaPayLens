/**
 * Manifests only: safe to import in pages without pulling in adapter code
 * or error catalogs.
 */
import type { ProviderManifest, ProviderResearchStatus, RolloutWave } from "@pandapaylens/core";
import { stripeManifest } from "@pandapaylens/stripe/manifest";
import { adyenManifest } from "@pandapaylens/adyen/manifest";
import { payablManifest } from "@pandapaylens/payabl/manifest";
import { braintreeManifest } from "@pandapaylens/braintree/manifest";
import { checkoutManifest } from "@pandapaylens/checkout/manifest";
import { paypalManifest } from "@pandapaylens/paypal/manifest";
import { mollieManifest } from "@pandapaylens/mollie/manifest";
import { squareManifest } from "@pandapaylens/square/manifest";
import { nuveiManifest } from "@pandapaylens/nuvei/manifest";
import { authorizeNetManifest } from "@pandapaylens/authorize-net/manifest";
import { cybersourceManifest } from "@pandapaylens/cybersource/manifest";
import { worldpayManifest } from "@pandapaylens/worldpay/manifest";
import { trustlyManifest } from "@pandapaylens/trustly/manifest";
import { dectaManifest } from "@pandapaylens/decta/manifest";
import { inpayManifest } from "@pandapaylens/inpay/manifest";
import { finraxManifest } from "@pandapaylens/finrax/manifest";
import { astropayManifest } from "@pandapaylens/astropay/manifest";
import { ezeewalletManifest } from "@pandapaylens/ezeewallet/manifest";
import { skrillManifest } from "@pandapaylens/skrill/manifest";
import { mifinityManifest } from "@pandapaylens/mifinity/manifest";
import { nmiManifest } from "@pandapaylens/nmi/manifest";
import { paymentwallManifest } from "@pandapaylens/paymentwall/manifest";
import { ecommpayManifest } from "@pandapaylens/ecommpay/manifest";
import { emerchantpayManifest } from "@pandapaylens/emerchantpay/manifest";
import { ccbillManifest } from "@pandapaylens/ccbill/manifest";
import { segpayManifest } from "@pandapaylens/segpay/manifest";
import { trustPaymentsManifest } from "@pandapaylens/trust-payments/manifest";
import { pxpManifest } from "@pandapaylens/pxp/manifest";
import { verotelManifest } from "@pandapaylens/verotel/manifest";
import { netbillingManifest } from "@pandapaylens/netbilling/manifest";

export const MANIFESTS: readonly ProviderManifest[] = [
  stripeManifest,
  adyenManifest,
  payablManifest,
  checkoutManifest,
  braintreeManifest,
  paypalManifest,
  mollieManifest,
  squareManifest,
  nuveiManifest,
  authorizeNetManifest,
  cybersourceManifest,
  worldpayManifest,
  trustlyManifest,
  dectaManifest,
  inpayManifest,
  finraxManifest,
  astropayManifest,
  ezeewalletManifest,
  skrillManifest,
  mifinityManifest,
  nmiManifest,
  paymentwallManifest,
  ecommpayManifest,
  emerchantpayManifest,
  ccbillManifest,
  segpayManifest,
  trustPaymentsManifest,
  pxpManifest,
  verotelManifest,
  netbillingManifest,
];

/** Roadmap focus areas, used for directory filters. Taken from the roadmap, not verified claims about the provider. */
export type RoadmapFocus =
  | "general"
  | "high_risk"
  | "gaming"
  | "subscription"
  | "wallet"
  | "pay_by_bank"
  | "gateway_acquiring"
  | "crypto";

export type RoadmapEntry = {
  id: string;
  displayName: string;
  wave: RolloutWave;
  /** Research status for providers without an adapter yet. Implemented providers use their manifest. */
  researchStatus: ProviderResearchStatus;
  focus: readonly RoadmapFocus[];
  note?: string;
};

/**
 * All providers on the roadmap. A provider counts as available only when it
 * has a manifest above; everything else is a research candidate or planned.
 */
export const ROADMAP: readonly RoadmapEntry[] = [
  { id: "stripe", displayName: "Stripe", wave: 0, researchStatus: "released", focus: ["general"] },
  {
    id: "adyen",
    displayName: "Adyen",
    wave: 0,
    researchStatus: "released",
    focus: ["general", "gateway_acquiring"],
  },
  {
    id: "payabl",
    displayName: "payabl.",
    wave: 1,
    researchStatus: "released",
    focus: ["general", "gateway_acquiring"],
  },
  {
    id: "checkout",
    displayName: "Checkout.com",
    wave: 1,
    researchStatus: "released",
    focus: ["general", "gateway_acquiring"],
  },
  {
    id: "paypal",
    displayName: "PayPal",
    wave: 1,
    researchStatus: "released",
    focus: ["general", "wallet"],
  },
  {
    id: "braintree",
    displayName: "Braintree",
    wave: 1,
    researchStatus: "released",
    focus: ["general", "gateway_acquiring"],
  },
  { id: "mollie", displayName: "Mollie", wave: 1, researchStatus: "released", focus: ["general"] },
  { id: "square", displayName: "Square", wave: 1, researchStatus: "released", focus: ["general"] },
  {
    id: "worldpay",
    displayName: "Worldpay (Access Worldpay)",
    wave: 2,
    researchStatus: "tested",
    focus: ["general", "gateway_acquiring"],
    note: "Access Worldpay JSON APIs and webhooks. The XML gateways (WPG, cnpAPI) are separate integrations and out of scope while XML is unsupported.",
  },
  {
    id: "cybersource",
    displayName: "Cybersource",
    wave: 2,
    researchStatus: "tested",
    focus: ["general", "gateway_acquiring"],
  },
  {
    id: "authorize_net",
    displayName: "Authorize.net",
    wave: 2,
    researchStatus: "tested",
    focus: ["general", "gateway_acquiring"],
  },
  {
    id: "nuvei",
    displayName: "Nuvei",
    wave: 2,
    researchStatus: "tested",
    focus: ["general", "gateway_acquiring"],
    note: "API generations and DMN formats are handled as separate families.",
  },
  {
    id: "paysafe",
    displayName: "Paysafe",
    wave: 2,
    researchStatus: "research_only",
    focus: ["general", "wallet"],
  },
  {
    id: "airwallex",
    displayName: "Airwallex",
    wave: 2,
    researchStatus: "research_only",
    focus: ["general"],
  },
  {
    id: "rapyd",
    displayName: "Rapyd",
    wave: 2,
    researchStatus: "research_only",
    focus: ["general"],
  },
  {
    id: "dlocal",
    displayName: "dLocal",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general"],
  },
  {
    id: "ebanx",
    displayName: "EBANX",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general"],
  },
  {
    id: "bluesnap",
    displayName: "BlueSnap",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general", "gateway_acquiring"],
  },
  {
    id: "payu_india",
    displayName: "PayU India",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general"],
    note: "PayU India only; other PayU regional platforms are separate integrations.",
  },
  {
    id: "razorpay",
    displayName: "Razorpay",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general"],
  },
  {
    id: "paystack",
    displayName: "Paystack",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general"],
  },
  {
    id: "flutterwave",
    displayName: "Flutterwave",
    wave: 3,
    researchStatus: "research_only",
    focus: ["general"],
  },
  // High-risk expansion. Research candidates until the
  // qualification gate and tests are passed.
  {
    id: "ccbill",
    displayName: "CCBill",
    wave: "HR-1",
    researchStatus: "tested",
    focus: ["high_risk", "subscription"],
  },
  {
    id: "segpay",
    displayName: "Segpay",
    wave: "HR-1",
    researchStatus: "tested",
    focus: ["high_risk", "subscription"],
  },
  {
    id: "verotel",
    displayName: "Verotel",
    wave: "HR-1",
    researchStatus: "tested",
    focus: ["high_risk", "subscription"],
  },
  {
    id: "netbilling",
    displayName: "NETbilling",
    wave: "HR-1",
    researchStatus: "tested",
    focus: ["high_risk", "subscription", "gateway_acquiring"],
  },
  {
    id: "pxp",
    displayName: "PXP Financial",
    wave: "HR-1",
    researchStatus: "tested",
    focus: ["high_risk", "gaming", "gateway_acquiring"],
  },
  {
    id: "trust_payments",
    displayName: "Trust Payments",
    wave: "HR-1",
    researchStatus: "tested",
    focus: ["high_risk", "gaming", "gateway_acquiring"],
  },
  {
    id: "emerchantpay",
    displayName: "emerchantpay",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "gateway_acquiring"],
  },
  {
    id: "ecommpay",
    displayName: "Ecommpay",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "gateway_acquiring"],
  },
  {
    id: "paymentwall",
    displayName: "Paymentwall",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "gaming", "subscription"],
  },
  {
    id: "nmi",
    displayName: "NMI",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "gateway_acquiring"],
  },
  {
    id: "mifinity",
    displayName: "MiFinity",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "wallet"],
  },
  {
    id: "astropay",
    displayName: "AstroPay",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "wallet"],
  },
  {
    id: "skrill",
    displayName: "Skrill",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "wallet"],
  },
  {
    id: "ezeewallet",
    displayName: "eZeeWallet",
    wave: "HR-2",
    researchStatus: "tested",
    focus: ["high_risk", "wallet"],
  },
  {
    id: "finrax",
    displayName: "Finrax",
    wave: "HR-3",
    researchStatus: "tested",
    focus: ["high_risk", "crypto"],
  },
  {
    id: "inpay",
    displayName: "Inpay",
    wave: "HR-3",
    researchStatus: "tested",
    focus: ["high_risk", "gaming", "pay_by_bank"],
  },
  {
    id: "decta",
    displayName: "DECTA",
    wave: "HR-3",
    researchStatus: "tested",
    focus: ["high_risk", "gateway_acquiring"],
  },
  {
    id: "trustly",
    displayName: "Trustly",
    wave: "HR-3",
    researchStatus: "tested",
    focus: ["high_risk", "pay_by_bank"],
  },
  {
    id: "pavilion_payments",
    displayName: "Pavilion Payments",
    wave: "HR-3",
    researchStatus: "blocked",
    focus: ["high_risk", "gaming"],
    note: "No public developer documentation or API access route could be verified. Remains a research candidate without an adapter.",
  },
  {
    id: "epoch",
    displayName: "Epoch",
    wave: "HR-3",
    researchStatus: "blocked",
    focus: ["high_risk", "subscription"],
    note: "Integration documentation is provided only after merchant sign-up, so it cannot be verified publicly. No adapter will be built from guesses.",
  },
];

export function manifestFor(id: string): ProviderManifest | undefined {
  return MANIFESTS.find((m) => m.id === id);
}
