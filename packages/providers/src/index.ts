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
import { flutterwaveAdapter } from "@pandapaylens/flutterwave";
import { paystackAdapter } from "@pandapaylens/paystack";
import { razorpayAdapter } from "@pandapaylens/razorpay";
import { payuIndiaAdapter } from "@pandapaylens/payu-india";
import { bluesnapAdapter } from "@pandapaylens/bluesnap";
import { ebanxAdapter } from "@pandapaylens/ebanx";
import { dlocalAdapter } from "@pandapaylens/dlocal";
import { rapydAdapter } from "@pandapaylens/rapyd";
import { airwallexAdapter } from "@pandapaylens/airwallex";
import { paysafeAdapter } from "@pandapaylens/paysafe";
import { nuveiAdapter } from "@pandapaylens/nuvei";
import { authorizeNetAdapter } from "@pandapaylens/authorize-net";
import { cybersourceAdapter } from "@pandapaylens/cybersource";
import { worldpayAdapter } from "@pandapaylens/worldpay";
import { trustlyAdapter } from "@pandapaylens/trustly";
import { dectaAdapter } from "@pandapaylens/decta";
import { inpayAdapter } from "@pandapaylens/inpay";
import { finraxAdapter } from "@pandapaylens/finrax";
import { astropayAdapter } from "@pandapaylens/astropay";
import { ezeewalletAdapter } from "@pandapaylens/ezeewallet";
import { skrillAdapter } from "@pandapaylens/skrill";
import { mifinityAdapter } from "@pandapaylens/mifinity";
import { nmiAdapter } from "@pandapaylens/nmi";
import { paymentwallAdapter } from "@pandapaylens/paymentwall";
import { ecommpayAdapter } from "@pandapaylens/ecommpay";
import { emerchantpayAdapter } from "@pandapaylens/emerchantpay";
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
  flutterwaveAdapter,
  paystackAdapter,
  razorpayAdapter,
  payuIndiaAdapter,
  bluesnapAdapter,
  ebanxAdapter,
  dlocalAdapter,
  rapydAdapter,
  airwallexAdapter,
  paysafeAdapter,
  nuveiAdapter,
  authorizeNetAdapter,
  cybersourceAdapter,
  worldpayAdapter,
  trustlyAdapter,
  dectaAdapter,
  inpayAdapter,
  finraxAdapter,
  astropayAdapter,
  ezeewalletAdapter,
  skrillAdapter,
  mifinityAdapter,
  nmiAdapter,
  paymentwallAdapter,
  ecommpayAdapter,
  emerchantpayAdapter,
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
