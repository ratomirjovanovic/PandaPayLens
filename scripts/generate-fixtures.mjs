// Generates the synthetic fixture files in /fixtures.
// All identifiers are synthetic (they contain "PPLsynth"/"PPLSYNTH"); no real
// cardholder, merchant or customer data may be added here.
//
// Usage: node scripts/generate-fixtures.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

const T0 = 1761379200; // 2025-10-25T08:00:00Z

const stripeEvent = (id, type, created, object, extra = {}) => ({
  id,
  object: "event",
  api_version: "2025-09-30.clover",
  created,
  livemode: false,
  pending_webhooks: 1,
  type,
  data: { object },
  ...extra,
});

const pi = (id, status, extra = {}) => ({
  id,
  object: "payment_intent",
  amount: 4999,
  currency: "eur",
  status,
  created: T0,
  livemode: false,
  ...extra,
});

const adyenItem = (fields) => ({
  NotificationRequestItem: { merchantAccountCode: "PandaPayLensSyntheticECOM", ...fields },
});
const adyenWebhook = (...items) => ({ live: "false", notificationItems: items.map(adyenItem) });

const files = {
  "stripe/successful-payment.json": [
    stripeEvent(
      "evt_1PPLsynthOK000001",
      "payment_intent.created",
      T0,
      pi("pi_3PPLsynthOK000001", "requires_payment_method", {
        capture_method: "automatic",
        payment_method_types: ["card"],
      }),
      {
        request: { id: "req_PPLsynth0001", idempotency_key: "ppl-synthetic-key-0001" },
      },
    ),
    stripeEvent(
      "evt_1PPLsynthOK000002",
      "charge.succeeded",
      T0 + 14,
      {
        id: "ch_3PPLsynthOK000001",
        object: "charge",
        amount: 4999,
        currency: "eur",
        status: "succeeded",
        paid: true,
        captured: true,
        payment_intent: "pi_3PPLsynthOK000001",
        billing_details: { email: "synthetic.customer@example.com", name: "Synthetic Customer" },
        payment_method_details: {
          card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
        },
        livemode: false,
      },
      { request: { id: "req_PPLsynth0002", idempotency_key: null } },
    ),
    stripeEvent(
      "evt_1PPLsynthOK000003",
      "payment_intent.succeeded",
      T0 + 14,
      pi("pi_3PPLsynthOK000001", "succeeded", {
        amount_received: 4999,
        capture_method: "automatic",
        client_secret: "pi_3PPLsynthOK000001_secret_PPLsyntheticSecret",
        latest_charge: "ch_3PPLsynthOK000001",
        payment_method_types: ["card"],
      }),
      { request: { id: "req_PPLsynth0002", idempotency_key: null } },
    ),
  ],

  "stripe/insufficient-funds.json": {
    error: {
      type: "card_error",
      code: "card_declined",
      decline_code: "insufficient_funds",
      message: "Your card has insufficient funds.",
      doc_url: "https://stripe.com/docs/error-codes/card-declined",
      payment_intent: pi("pi_3PPLsynthNSF00001", "requires_payment_method", {
        amount: 12000,
        currency: "usd",
        last_payment_error: {
          type: "card_error",
          code: "card_declined",
          decline_code: "insufficient_funds",
          message: "Your card has insufficient funds.",
        },
      }),
    },
  },

  "stripe/authentication-required.json": [
    stripeEvent(
      "evt_1PPLsynth3DS00001",
      "payment_intent.created",
      T0 + 3600,
      pi("pi_3PPLsynth3DS00001", "requires_payment_method", { amount: 2500 }),
    ),
    stripeEvent(
      "evt_1PPLsynth3DS00002",
      "payment_intent.requires_action",
      T0 + 3605,
      pi("pi_3PPLsynth3DS00001", "requires_action", {
        amount: 2500,
        next_action: { type: "use_stripe_sdk" },
      }),
    ),
    {
      error: {
        type: "card_error",
        code: "authentication_required",
        decline_code: "authentication_required",
        message: "Your card was declined. This transaction requires authentication.",
        payment_intent: {
          id: "pi_3PPLsynth3DS00001",
          object: "payment_intent",
          status: "requires_action",
        },
      },
    },
  ],

  "stripe/duplicate-webhook.json": [0, 72].map((delay) => ({
    receivedAt: new Date((T0 + 3 + delay) * 1000).toISOString(),
    payload: stripeEvent(
      "evt_1PPLsynthDUP00001",
      "payment_intent.succeeded",
      T0,
      pi("pi_3PPLsynthDUP00001", "succeeded", {
        amount: 1500,
        currency: "gbp",
        latest_charge: "ch_3PPLsynthDUP00001",
      }),
    ),
  })),

  "stripe/out-of-order.json": [
    {
      receivedAt: new Date((T0 + 9) * 1000).toISOString(),
      payload: stripeEvent(
        "evt_1PPLsynthOOO00003",
        "payment_intent.succeeded",
        T0 + 6,
        pi("pi_3PPLsynthOOO00001", "succeeded", {
          amount: 8800,
          currency: "usd",
          latest_charge: "ch_3PPLsynthOOO00001",
        }),
      ),
    },
    {
      receivedAt: new Date((T0 + 10) * 1000).toISOString(),
      payload: stripeEvent(
        "evt_1PPLsynthOOO00001",
        "payment_intent.created",
        T0,
        pi("pi_3PPLsynthOOO00001", "requires_payment_method", { amount: 8800, currency: "usd" }),
      ),
    },
    {
      receivedAt: new Date((T0 + 12) * 1000).toISOString(),
      payload: stripeEvent("evt_1PPLsynthOOO00002", "charge.succeeded", T0 + 5, {
        id: "ch_3PPLsynthOOO00001",
        object: "charge",
        amount: 8800,
        currency: "usd",
        status: "succeeded",
        paid: true,
        captured: true,
        payment_intent: "pi_3PPLsynthOOO00001",
      }),
    },
  ],

  "stripe/api-error-unknown-outcome.json": {
    error: {
      type: "api_error",
      message: "An unknown error occurred while processing your request.",
    },
  },

  "stripe/thin-event.json": {
    id: "evt_test_65PPLsynthTHIN0001",
    object: "v2.core.event",
    type: "v1.billing.meter.error_report_triggered",
    created: "2026-10-25T12:00:00.000Z",
    related_object: {
      id: "mtr_test_PPLsynth0001",
      type: "billing.meter",
      url: "/v1/billing/meters/mtr_test_PPLsynth0001",
    },
  },

  "stripe/state-inconsistency.json": [
    stripeEvent(
      "evt_1PPLsynthINC00001",
      "payment_intent.succeeded",
      T0 + 100,
      pi("pi_3PPLsynthINC00001", "succeeded"),
    ),
    stripeEvent(
      "evt_1PPLsynthINC00002",
      "payment_intent.processing",
      T0 + 160,
      pi("pi_3PPLsynthINC00001", "processing"),
    ),
  ],

  "adyen/successful-authorisation.json": adyenWebhook({
    additionalData: {
      hmacSignature: "PPLsyntheticHmacSignatureValue0000000000000=",
      cardSummary: "1111",
      expiryDate: "03/2030",
    },
    amount: { currency: "EUR", value: 1999 },
    eventCode: "AUTHORISATION",
    eventDate: "2026-10-25T09:00:00+02:00",
    merchantReference: "PPL-ORDER-0001",
    operations: ["CANCEL", "CAPTURE", "REFUND"],
    paymentMethod: "visa",
    pspReference: "PPLSYNTH0000AUT1",
    // Adyen puts auth code, card summary and expiry here on success; the adapter drops it.
    reason: "011873:1111:03/2030",
    success: "true",
  }),

  "adyen/declined-authorisation.json": [
    {
      pspReference: "PPLSYNTH0000DEC1",
      resultCode: "Refused",
      refusalReason: "Not enough balance",
      refusalReasonCode: "12",
      merchantReference: "PPL-ORDER-0002",
      amount: { currency: "EUR", value: 25000 },
    },
    adyenWebhook({
      amount: { currency: "EUR", value: 25000 },
      eventCode: "AUTHORISATION",
      eventDate: "2026-10-25T09:10:00+02:00",
      merchantReference: "PPL-ORDER-0002",
      paymentMethod: "mc",
      pspReference: "PPLSYNTH0000DEC1",
      reason: "Not enough balance",
      success: "false",
    }),
  ],

  "adyen/authorisation-and-capture.json": adyenWebhook(
    {
      amount: { currency: "EUR", value: 7500 },
      eventCode: "AUTHORISATION",
      eventDate: "2026-10-25T08:00:00+00:00",
      merchantReference: "PPL-ORDER-0003",
      operations: ["CANCEL", "CAPTURE", "REFUND"],
      paymentMethod: "visa",
      pspReference: "PPLSYNTH0000AUT3",
      success: "true",
    },
    {
      amount: { currency: "EUR", value: 7500 },
      eventCode: "CAPTURE",
      eventDate: "2026-10-25T08:30:00+00:00",
      merchantReference: "PPL-ORDER-0003",
      originalReference: "PPLSYNTH0000AUT3",
      paymentMethod: "visa",
      pspReference: "PPLSYNTH0000CAP3",
      success: "true",
    },
    {
      amount: { currency: "EUR", value: 2500 },
      eventCode: "REFUND",
      eventDate: "2026-10-26T10:00:00+00:00",
      merchantReference: "PPL-ORDER-0003",
      originalReference: "PPLSYNTH0000AUT3",
      paymentMethod: "visa",
      pspReference: "PPLSYNTH0000REF3",
      success: "true",
    },
  ),

  "adyen/duplicate-and-conflict.json": [
    [
      "2026-10-25T08:00:05Z",
      {
        eventCode: "AUTHORISATION",
        eventDate: "2026-10-25T08:00:00+00:00",
        pspReference: "PPLSYNTH0000AUT4",
        success: "true",
      },
    ],
    [
      "2026-10-25T08:05:05Z",
      {
        eventCode: "AUTHORISATION",
        eventDate: "2026-10-25T08:00:00+00:00",
        pspReference: "PPLSYNTH0000AUT4",
        success: "true",
      },
    ],
    [
      "2026-10-25T09:00:00Z",
      {
        eventCode: "CAPTURE",
        eventDate: "2026-10-25T08:55:00+00:00",
        originalReference: "PPLSYNTH0000AUT4",
        pspReference: "PPLSYNTH0000CAP4",
        success: "false",
        reason: "Insufficient balance on payment",
      },
    ],
    [
      "2026-10-25T09:10:00Z",
      {
        eventCode: "CAPTURE",
        eventDate: "2026-10-25T08:55:00+00:00",
        originalReference: "PPLSYNTH0000AUT4",
        pspReference: "PPLSYNTH0000CAP4",
        success: "true",
      },
    ],
  ].map(([receivedAt, item]) => ({
    receivedAt,
    payload: adyenWebhook({
      amount: { currency: "EUR", value: 990 },
      merchantReference: "PPL-ORDER-0004",
      ...item,
    }),
  })),

  "adyen/retry-risk.json": [
    {
      pspReference: "PPLSYNTH0000RTY1",
      resultCode: "Authorised",
      merchantReference: "PPL-ORDER-0005",
      amount: { currency: "EUR", value: 4200 },
    },
    { status: 500, errorCode: "000", message: "An unknown error occurred.", errorType: "internal" },
    {
      pspReference: "PPLSYNTH0000RTY2",
      resultCode: "Authorised",
      merchantReference: "PPL-ORDER-0005",
      amount: { currency: "EUR", value: 4200 },
    },
  ],

  "adyen/api-error.json": {
    status: 422,
    errorCode: "130",
    message: "Required field 'reference' is not provided.",
    errorType: "validation",
    pspReference: "PPLSYNTH0000ERR1",
  },

  "adyen/balance-platform-webhook.json": {
    data: { balancePlatform: "PandaPayLensSynthetic", id: "PPLSYNTHBP000001" },
    environment: "test",
    type: "balancePlatform.accountHolder.created",
  },

  "malformed/unknown-provider-error.json": {
    status: "error",
    message: "Payment could not be processed",
    code: "E_GENERIC_500",
  },

  "malformed/xss.json": {
    error: {
      type: "card_error",
      code: "<img src=x onerror=alert(1)>",
      decline_code: "<script>alert('decline')</script>",
      message: "<b onmouseover=alert(2)>hover</b> [click](javascript:alert(3))",
      payment_intent: {
        id: "pi_PPLsynthXSS<svg/onload=alert(4)>",
        object: "payment_intent",
        status: "requires_payment_method",
      },
    },
  },

  "malformed/prototype-pollution.json": JSON.parse(
    '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"error":{"type":"card_error","code":"card_declined","decline_code":"generic_decline"}}',
  ),

  "mixed/unrelated-transactions.json": [
    stripeEvent(
      "evt_1PPLsynthMIX00001",
      "payment_intent.succeeded",
      T0 + 20000,
      pi("pi_3PPLsynthMIXA0001", "succeeded", { amount: 1000, currency: "usd" }),
    ),
    stripeEvent(
      "evt_1PPLsynthMIX00002",
      "payment_intent.payment_failed",
      T0 + 20100,
      pi("pi_3PPLsynthMIXB0001", "requires_payment_method", {
        amount: 3000,
        currency: "usd",
        last_payment_error: {
          type: "card_error",
          code: "card_declined",
          decline_code: "generic_decline",
          message: "Your card was declined.",
        },
      }),
    ),
    stripeEvent("evt_1PPLsynthMIX00003", "invoice.paid", T0 + 20200, {
      id: "in_PPLsynthMIX0001",
      object: "invoice",
      status: "paid",
    }),
    adyenWebhook({
      amount: { currency: "EUR", value: 500 },
      eventCode: "AUTHORISATION",
      eventDate: "2026-10-25T13:00:00+00:00",
      merchantReference: "PPL-ORDER-0006",
      pspReference: "PPLSYNTH0000MIX1",
      success: "true",
    }),
  ],
};

for (const [rel, data] of Object.entries(files)) {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

// Raw text fixtures that are intentionally not valid JSON.
writeFileSync(
  join(root, "malformed/invalid-json.txt"),
  '{ id: "evt_1PPLsynthBAD", "object": "event", "type": "charge.failed" }\n',
);
writeFileSync(
  join(root, "stripe/events.jsonl"),
  files["stripe/out-of-order.json"].map((r) => JSON.stringify(r.payload)).join("\n") + "\n",
);

console.log(`Wrote ${Object.keys(files).length + 2} fixture files to ${root}`);
