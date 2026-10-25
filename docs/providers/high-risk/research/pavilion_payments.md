# Pavilion Payments (adapter id `pavilion_payments`): high-risk provider research

Status: qualification gate only. No technical specification is written, because Pavilion Payments publishes no developer or API documentation. Everything below comes from Pavilion Payments' own public website as read on the verification date. When a point is not documented publicly, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **blocked** (no public first-party API documentation; API access cannot be verified)

---

## 1. Sources

All URLs below were read on 2026-10-25.

| URL                                                                                                                                                          | What it showed                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://pavilionpayments.com/                                                                                                                                | Home page of "Pavilion Payments Gaming Services Inc." (Las Vegas, NV). Product menu: Cash Advance, Cashless (VIP Mobility, Tap2Play / Apple Pay), Choice4 Deferred Settlement, Compliance, iGaming, Kiosks, VIP Preferred eCheck/ACH, DiTRONICS. No developer, API or login link.                                                                 |
| https://pavilionpayments.com/igaming                                                                                                                         | "Pavilion Payments' iGaming Solutions" for "Online casino, mobile gaming, DFS, iLottery and more"; VIP Online Banking; "VIP Connect offers operators a seamless and efficient foundation to simplify the integration" of VIP Preferred / VIP Online, built on "industry-leading iGaming XML standard format for storing data". No technical link. |
| https://pavilionpayments.com/e-check                                                                                                                         | "VIP Preferred, our eCheck network, is available in more than 350 North American land-based casinos and iGaming sites."; "Pavilion Payments fully guarantees all check transactions." No technical link.                                                                                                                                          |
| https://pavilionpayments.com/solutions-online                                                                                                                | VIP LightSpeed platform; "Power funding and disbursements for online sports betting and daily fantasy sports."; i-Lottery. No API or SDK reference.                                                                                                                                                                                               |
| https://pavilionpayments.com/about                                                                                                                           | Gaming industry focus; no licences, jurisdictions or API information.                                                                                                                                                                                                                                                                             |
| https://pavilionpayments.com/security                                                                                                                        | EMV, encryption and tokenization claims; no PCI, API or developer-access statement.                                                                                                                                                                                                                                                               |
| https://pavilionpayments.com/pavilion-news                                                                                                                   | News index (CEO appointments, DiTRONICS and CasinoSoft acquisitions). No SDK, API or developer article in the listing.                                                                                                                                                                                                                            |
| https://pavilionpayments.com/pavilion-news/pavilion-payments-names-mary-beth-higgins-chief-executive-officer-promotes-alyssa-beaver-to-chief-revenue-officer | Press release dated October 8, 2026, Las Vegas, NV; company boilerplate.                                                                                                                                                                                                                                                                          |
| https://pavilionpayments.com/developers, https://pavilionpayments.com/api                                                                                    | HTTP 404.                                                                                                                                                                                                                                                                                                                                         |
| developer., developers., docs., api. subdomains of pavilionpayments.com                                                                                      | Do not resolve (no DNS answer).                                                                                                                                                                                                                                                                                                                   |

Not used as evidence (third party, per the research method): search results show that other gateways (for example Nuvei and Kalixa developer pages) describe VIP Preferred as a method inside their own APIs, and trade press describes a 2023 Pavilion SDK announcement. Those pages document the other gateways' formats, not Pavilion's, and were not used.

---

## 2. Qualification gate

| #   | Item                                                                               | Answer                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company or product currently active                                                | **yes**                             | Press release dated October 8, 2026 on https://pavilionpayments.com/pavilion-news/...mary-beth-higgins... ; home page lists current products and a Las Vegas address.                                                                                                                                                                                                                           |
| 2   | Relevant payment service operational                                               | **yes** (as stated by the provider) | https://pavilionpayments.com/e-check: VIP Preferred "is available in more than 350 North American land-based casinos and iGaming sites."                                                                                                                                                                                                                                                        |
| 3   | Official developer documentation publicly or legitimately accessible               | **no**                              | No developer portal, API reference, SDK repository or PDF guide is linked anywhere on the site. `/developers` and `/api` return 404; developer/docs/api subdomains do not resolve. No merchant login link exists on the public site either. Public: marketing pages only. Gated or private: all technical documentation (access route NOT DOCUMENTED; presumably through operator contracting). |
| 4   | API families and versions identified                                               | **no**                              | Only product names are published: "VIP Connect" (integration foundation, "iGaming XML standard format"), VIP Preferred, VIP Online. No endpoint, protocol, schema name or version.                                                                                                                                                                                                              |
| 5   | Responses or notifications examinable offline                                      | **no**                              | No response, status, notification or XML example is published.                                                                                                                                                                                                                                                                                                                                  |
| 6   | Supported merchant sectors documented                                              | **yes**                             | See Sectors below (gaming only).                                                                                                                                                                                                                                                                                                                                                                |
| 7   | Regional or regulatory limitations identified                                      | **partial**                         | Network is described as North American ("more than 350 North American land-based casinos and iGaming sites"). Specific US states, licences or regulators are NOT DOCUMENTED on the pages read. Compliance products (AML Title 31, tax forms) are offered but are not regulatory status statements.                                                                                              |
| 8   | Adapter would give actual diagnostic value                                         | **unclear**                         | No codes, statuses or notification fields are published.                                                                                                                                                                                                                                                                                                                                        |
| 9   | Own technical formats (not reselling another gateway)                              | **unclear**                         | Pavilion runs its own eCheck/ACH network (VIP Preferred) and states that VIP Connect uses the "iGaming XML standard format". The actual message format is not published, so independence cannot be confirmed. Third-party gateways also expose VIP Preferred inside their own APIs; a payload pasted from such a gateway would be that gateway's format, not Pavilion's.                        |
| 10  | No live credentials or merchant relationship needed to analyze documented examples | **no**                              | There are no public examples; any technical material would require an operator relationship.                                                                                                                                                                                                                                                                                                    |

### Current documentation and API access check (explicitly required)

- **Current documentation:** not available from public first-party sources. Nothing dated, versioned or downloadable exists on pavilionpayments.com.
- **API access:** not publicly described. No sign-up or developer registration route is published, and requesting access is out of scope for this research.
- **Result:** fails both checks, so the outcome is `blocked`.

---

## 3. Classification

| Class                                                                                           | Applies                               | Evidence                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `alternative_payment_method`                                                                    | yes                                   | VIP Preferred eCheck/ACH network and VIP Online Banking (https://pavilionpayments.com/e-check, https://pavilionpayments.com/igaming).      |
| `wallet`                                                                                        | partial                               | Cashless products (VIP Mobility "on-premise mobile funding app") on the home page; whether a stored-value wallet exists is NOT DOCUMENTED. |
| `card_processing`                                                                               | partial (land-based cash access only) | "Cash Advance" using debit or credit cards and ATM/kiosk products (home page). No online card API is described.                            |
| `gateway`, `acquiring`, `payment_facilitator`, `orchestration`, `merchant_account_intermediary` | not stated                            | NOT DOCUMENTED.                                                                                                                            |

Other service lines (not payment classes): compliance software (AML Title 31, tax forms, document management), kiosks and ATMs, deferred settlement (Choice4).

### Sectors (only as documented by Pavilion Payments)

| Sector                                 | Source                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| land-based gaming (casinos)            | https://pavilionpayments.com/e-check ("North American land-based casinos"); home page ("physical and online gaming institutions") |
| iGaming (online casino, mobile gaming) | https://pavilionpayments.com/igaming ("Online casino, mobile gaming, DFS, iLottery and more")                                     |
| daily fantasy sports                   | https://pavilionpayments.com/igaming ("DFS"); https://pavilionpayments.com/solutions-online                                       |
| online sports betting                  | https://pavilionpayments.com/solutions-online ("online sports betting and daily fantasy sports")                                  |
| iLottery                               | https://pavilionpayments.com/igaming, https://pavilionpayments.com/solutions-online                                               |

No non-gaming sector is documented. Eligibility depends on jurisdiction, licensing and underwriting; listing a sector here does not imply any operator would be accepted.

---

## 4. What is known and what is missing

Known (first-party):

- Products relevant to online payments: VIP Preferred eCheck/ACH (funding and disbursements), VIP Online Banking (one account linked to up to four checking accounts), VIP Connect integration layer. The igaming page mentions "SameDay ACH, Instant Payments via RTP and FedNow".
- "Pavilion Payments fully guarantees all check transactions" (so a guarantee or decline decision exists, but its representation is NOT DOCUMENTED).

Missing (all NOT DOCUMENTED publicly):

- API protocol, endpoints, versions, content type (the "iGaming XML standard" is named but no schema is published).
- Status values, decline or return codes (including ACH return handling), error format.
- Notification or callback format, signature fields, retry behavior.
- Identifiers for patron, transaction, operator reference.
- Sandbox, test data or examples.

---

## 5. Technical specification

Not written. Gate outcome is `blocked`. No field, code or format is recorded because none is published by Pavilion Payments.

Proposed capability statuses (for the registry, if a compatibility entry is wanted):

| Capability       | Proposed    | Justification                     |
| ---------------- | ----------- | --------------------------------- |
| errorDecoding    | unsupported | No public code table.             |
| paymentResponses | unsupported | No public response format.        |
| webhookParsing   | unsupported | No public notification format.    |
| timeline         | unsupported | No public status vocabulary.      |
| correlation      | unsupported | No public identifier definitions. |

## 6. Path to re-qualification

Re-run the gate if Pavilion Payments publishes VIP Connect or VIP Preferred technical documentation (developer portal, schema, PDF guide or official SDK repository) readable without login. Payloads that carry VIP Preferred inside another gateway's response should be handled by that gateway's adapter, not by a `pavilion_payments` adapter.
