# Epoch (adapter id `epoch`): high-risk provider research

Status: qualification gate only. No technical specification is written, because Epoch does not publish its integration documentation. Everything below comes from Epoch's own public website as read on the verification date. When a point is not documented publicly, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **blocked** (current integration documentation and API access cannot be verified from public first-party sources)

---

## 1. Sources

All URLs below were read on 2026-10-25.

| URL                                                              | What it showed                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://www.epoch.com/                                           | Home page: "A pioneer of payment solutions for online merchants since 1996"; links to Billing Support, Merchant Solutions, Sign Up, Merchant Login; footer "Copyright 2026 Epoch". No developer or documentation link.    |
| https://www.epoch.com/business_services (also `?ref=ml`)         | Merchant Solutions page: billing models (recurring, per unit, one-time, one-click), payment types, currencies, languages, EU region list, technical support, registration fee, FAQ including the API answer quoted below. |
| https://www.epoch.com/business_services/contract_initiation.html | Sign-up form ("Complete the form below to begin the sign up process"; "An account representative will be in touch with you within 24 hours"). No documentation. Not submitted.                                            |
| https://www.epoch.com/merchant/user_signin.html                  | Merchant login page (HTTP 200). Not used.                                                                                                                                                                                 |
| https://epoch.com/legal_docs/legal.html                          | Legal page for "Epoch Payment Solutions", Wilson, Wyoming address; "We are a provider of payment processing services in the Visa USA and Europe regions."                                                                 |
| https://www.epoch.com/robots.txt                                 | No sitemap or documentation paths listed.                                                                                                                                                                                 |
| https://www.epoch.com/docs, https://www.epoch.com/developers     | HTTP 404.                                                                                                                                                                                                                 |
| https://www.epoch.com/sitemap.xml                                | HTTP 404.                                                                                                                                                                                                                 |
| https://github.com/epochcom                                      | GitHub organization named "Epochcom" with no description, no website link and "no public repositories". Not attributable to Epoch; not used as evidence.                                                                  |

Not used as evidence (third party, per the research method): plugin pages, forum posts and other gateways' setup guides that describe Epoch parameters (for example `pi_code`, Data Plus `ets_*` fields, `epoch_digest`). They were seen in search results only and their content is not reproduced here as fact.

---

## 2. Qualification gate

| #   | Item                                                                               | Answer                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company or product currently active                                                | **yes**                             | https://www.epoch.com/ shows "Copyright 2026 Epoch", a working merchant login, a sign-up flow and 24/7 support numbers.                                                                                                                                                                                                                                                                              |
| 2   | Relevant payment service operational                                               | **yes** (as stated by the provider) | https://www.epoch.com/business_services offers live sign-up for payment processing and lists billing models and payment types. Operational status of any specific API cannot be checked without access.                                                                                                                                                                                              |
| 3   | Official developer documentation publicly or legitimately accessible               | **no**                              | FAQ on https://www.epoch.com/business_services: Q "Do you offer application progamming interfaces (API)?" A "Sure do. In order for us to send you the APIs, you need to start the sign up process." No public developer portal; `/docs` and `/developers` return 404. Public: marketing pages only. Gated: all API and integration documentation (sent after sign-up), merchant back office (login). |
| 4   | API families and versions identified                                               | **no**                              | The site says it offers "feature-rich APIs that allowing you to customize data structures, object classes, and variables", but names no API, endpoint, product name or version.                                                                                                                                                                                                                      |
| 5   | Responses or notifications examinable offline                                      | **no**                              | No documented response, postback or notification format is published by Epoch.                                                                                                                                                                                                                                                                                                                       |
| 6   | Supported merchant sectors documented                                              | **partial**                         | See Sectors below. Epoch documents billing models and a registration fee for digital content merchants; it does not publish an accepted-sector list.                                                                                                                                                                                                                                                 |
| 7   | Regional or regulatory limitations identified                                      | **partial**                         | legal.html: provider "in the Visa USA and Europe regions". business_services: EU merchants "must be incorporated in the card associations' Europe region"; "merchants selling digital content from a US and EU based company are required to pay the Visa and MasterCard registration fee" ("The initial fee and annual renewal is $1,950."). No licence or regulator named.                         |
| 8   | Adapter would give actual diagnostic value                                         | **unclear**                         | No error codes, statuses or notification fields are published, so value cannot be assessed.                                                                                                                                                                                                                                                                                                          |
| 9   | Own technical formats (not reselling another gateway)                              | **unclear**                         | Epoch describes itself as a payment processing provider that "handles every aspect of billing" with a hosted payment page; no format is published, so independence of format cannot be verified. No underlying gateway is named.                                                                                                                                                                     |
| 10  | No live credentials or merchant relationship needed to analyze documented examples | **no**                              | There are no public examples; obtaining the APIs requires starting the merchant sign-up process.                                                                                                                                                                                                                                                                                                     |

### Current documentation and API access check (explicitly required)

- **Current documentation:** not verifiable. Epoch publishes no versioned or dated integration documentation. The only first-party statement is that APIs are sent after the sign-up process starts.
- **API access:** gated behind merchant onboarding. Starting sign-up would be requesting access, which the research method excludes, so it was not done.
- **Result:** fails both checks, so the outcome is `blocked`.

---

## 3. Classification

Evidence-based, limited to what Epoch states:

| Class                                                         | Applies                          | Evidence                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`                                             | yes                              | legal.html: "We are a provider of payment processing services in the Visa USA and Europe regions."; business_services lists Visa, Mastercard, Maestro, Discover, JCB, Diners.                                                                                 |
| `gateway`                                                     | unclear                          | Hosted payment page and "Easy Integration" are described, but no gateway API is documented.                                                                                                                                                                   |
| `merchant_account_intermediary`                               | unclear                          | Epoch processes "on your behalf" (chargeback and credit fees "for processing ... on your behalf"; "We do not require a security deposit nor do we withhold a reserve"). Whether Epoch acts as merchant of record or billing agent is NOT DOCUMENTED publicly. |
| `alternative_payment_method`                                  | partial (as a method aggregator) | business_services lists non-card payment types such as BLIK, PayPal and PIX.                                                                                                                                                                                  |
| `acquiring`, `payment_facilitator`, `wallet`, `orchestration` | not stated                       | NOT DOCUMENTED.                                                                                                                                                                                                                                               |

Billing models documented (not sectors): recurring subscription ("You can offer your customers the ability to purchase a subscription that bills automatically until the customer cancels."), per unit (tokens, credits, blocks of time), one-time, one-click.

### Sectors (only as documented by Epoch)

| Sector                       | Source                                                                                                                                                                    | Note                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| digital content              | https://www.epoch.com/business_services ("merchants selling digital content from a US and EU based company are required to pay the Visa and MasterCard registration fee") | Shows digital content merchants are within scope and subject to scheme registration. Not a statement of approval for any sub-sector. |
| subscription (billing model) | https://www.epoch.com/business_services ("purchase a subscription that bills automatically until the customer cancels")                                                   | A billing model, not an industry.                                                                                                    |
| General statement            | https://www.epoch.com/business_services ("companies ranging from internet start-ups to large multi-national organizations")                                               | Not a sector list.                                                                                                                   |

No other sector (for example adult, dating, gaming) is named on Epoch's public pages read on the verification date. Third-party descriptions of Epoch's sectors are not used. Eligibility always depends on jurisdiction, licensing and underwriting.

---

## 4. What is known and what is missing

Known (first-party):

- Hosted billing with recurring, per-unit, one-time and one-click models; payment page shown in multiple currencies and languages.
- Chargeback handling fee ($12.50) and credit (refund) fee ($1) exist, so chargebacks and credits are lifecycle events Epoch handles.
- 24/7 technical support that will "test your links for proper setup", which suggests link-based (hosted page) integration. Exact link format is NOT DOCUMENTED.

Missing (all NOT DOCUMENTED publicly):

- API names, endpoints, versions, content types.
- Response fields, status values, decline or error codes.
- Postback / notification format, event types, signature or digest fields, retry behavior.
- Identifiers (transaction, subscription/member, product/package code, merchant reference).
- Subscription lifecycle states (trial, rebill, cancel, expire), refund and chargeback event representation.
- Sandbox or test payloads.

---

## 5. Technical specification

Not written. Gate outcome is `blocked`. No field, code or format is recorded because none is published by Epoch.

Proposed capability statuses (for the registry, if a compatibility entry is wanted):

| Capability       | Proposed    | Justification                                       |
| ---------------- | ----------- | --------------------------------------------------- |
| errorDecoding    | unsupported | No public code table.                               |
| paymentResponses | unsupported | No public response format.                          |
| webhookParsing   | unsupported | No public postback format or signature description. |
| timeline         | unsupported | No public status or event vocabulary.               |
| correlation      | unsupported | No public identifier definitions.                   |

## 6. Path to re-qualification

Re-run the gate if Epoch publishes integration documentation (for example a public developer portal, PDF guide or official SDK repository) that can be read without sign-up or login. Until then, payload field names seen in third-party plugins must not be used to build an adapter.
