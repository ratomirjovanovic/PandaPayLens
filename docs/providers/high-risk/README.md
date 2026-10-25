# High-risk payment providers

PandaPayLens can analyze payloads from several providers that serve high-risk and regulated merchant sectors (subscriptions, adult, iGaming, travel, CBD and others). This page explains how these providers were researched, what can be decoded today, and what PandaPayLens does **not** do.

> PandaPayLens is a diagnostic tool. It is not a merchant account, referral, underwriting or approval service. Listing a provider implies no partnership or endorsement. Whether a provider accepts a merchant depends on jurisdiction, licensing, acquiring arrangements, merchant history and the provider's current policies, never on anything shown here.

## Research methodology

Every candidate goes through the qualification gate in [research-brief.md](research-brief.md):

1. Only first-party sources: the provider's website, developer portal, API reference, official SDKs and PDF guides.
2. No logins, no access requests, no reverse engineering, no invented fields or codes.
3. A 10-point gate: active service, accessible documentation, identified API family, offline-examinable formats, documented sectors, regional limits, real diagnostic value, independent technical format, and no credentials needed.
4. Outcome: `documentation_verified` (an adapter can be built), `research_only` (partial) or `blocked` (no verifiable documentation).
5. Sectors are recorded only as the provider itself states them, each with a source link. Approval for one sector never implies another.

Research files for each candidate are in [research/](research/).

## Status (2026-10-25)

| Provider          | Wave | Research                                                       | Adapter         |
| ----------------- | ---- | -------------------------------------------------------------- | --------------- |
| CCBill            | HR-1 | documentation verified                                         | tested, limited |
| Segpay            | HR-1 | documentation verified                                         | tested, limited |
| Verotel           | HR-1 | documentation verified                                         | tested, limited |
| NETbilling        | HR-1 | documentation verified                                         | tested, limited |
| PXP Financial     | HR-1 | documentation verified                                         | tested, limited |
| Trust Payments    | HR-1 | documentation verified                                         | tested, limited |
| emerchantpay      | HR-2 | documentation verified                                         | not yet         |
| Ecommpay          | HR-2 | documentation verified                                         | not yet         |
| Paymentwall       | HR-2 | documentation verified                                         | not yet         |
| NMI               | HR-2 | documentation verified                                         | not yet         |
| MiFinity          | HR-2 | documentation verified                                         | not yet         |
| AstroPay          | HR-2 | documentation verified                                         | not yet         |
| Skrill            | HR-2 | documentation verified                                         | not yet         |
| eZeeWallet        | HR-2 | documentation verified                                         | not yet         |
| Finrax            | HR-3 | documentation verified                                         | not yet         |
| Inpay             | HR-3 | documentation verified                                         | not yet         |
| DECTA             | HR-3 | documentation verified                                         | not yet         |
| Trustly           | HR-3 | documentation verified                                         | not yet         |
| Pavilion Payments | HR-3 | blocked: no public developer documentation or API access route | none            |
| Epoch             | HR-3 | blocked: integration documentation only after merchant sign-up | none            |

Per-capability statuses of the tested adapters are on each provider page and in the README table, generated from the adapter manifests.

## Lifecycle concepts

High-risk integrations rely heavily on subscriptions, asynchronous notifications and payouts. PandaPayLens keeps these concepts separate instead of forcing them into one card state machine:

| Concept                                  | Normalized as                | Notes                                                                                                                          |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Initial charge or signup                 | `payment`                    |                                                                                                                                |
| Rebill (recurring charge)                | `payment` with `isRecurring` | A failed rebill triggers `RECURRING_PAYMENT_FAILED`; a provider-supplied next retry date is shown, not predicted.              |
| Cancellation, expiry, upgrade, downgrade | `subscription`               | Expiry often carries no reason; PandaPayLens does not guess one.                                                               |
| Refund or credit                         | `refund`                     | A refund initiation is not a completed refund (`REFUND_PENDING`).                                                              |
| Chargeback or dispute                    | `dispute`                    | `CHARGEBACK_REPORTED` links it to an earlier successful payment when the records show one.                                     |
| Payout (e.g. gaming withdrawal)          | `payout`                     | Failed or unconfirmed payouts are reported by `PAYOUT_STATUS`; a new payout should only be sent once the failure is confirmed. |
| Wallet or bank transfer                  | the provider's own operation | A wallet approval is never treated as a card authorization.                                                                    |

## Webhook troubleshooting

Common findings with these providers:

- **No event id or timestamp.** Several providers (Verotel, Segpay, NETbilling, Trust Payments notifications) send postbacks without a delivery id or time. PandaPayLens then cannot detect duplicates or order events reliably, and says so instead of guessing.
- **Event type outside the body.** CCBill sends the webhook event type only in the URL query string. Paste the raw HTTP request or the full URL so it can be read.
- **Query-string postbacks.** Verotel FlexPay postbacks are GET requests; paste the full URL or the raw request.
- **Merchant-configurable fields.** Segpay custom postbacks and Trust Payments notifications can rename or drop fields; such payloads are recognized but analyzed only as far as the documented defaults allow.
- **Unverified by design.** Pasted postbacks and webhooks are never treated as authenticated. Signature fields are hidden and never checked.

## Known documentation limitations

Each research file lists the inconsistencies found in the provider's own documentation (conflicting code meanings, invalid examples, undocumented fields). Adapters handle them conservatively: ambiguous codes show every documented meaning with lower confidence, and unknown codes stay unknown.

## Adding a provider

Follow [docs/contributing/add-provider.md](../../contributing/add-provider.md) and the high-risk section of [adapter-brief.md](../../contributing/adapter-brief.md).
