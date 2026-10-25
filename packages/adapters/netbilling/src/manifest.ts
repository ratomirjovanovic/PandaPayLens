import type { ProviderManifest } from "@pandapaylens/core";

export const NETBILLING_ADAPTER_VERSION = "0.1.0";

const ONLINE = "https://www.netbilling.com/transaction-processing/online-processing/";
const PROCESSING = "https://www.netbilling.com/transaction-processing/";
const ABOUT = "https://www.netbilling.com/about/";
const DOCS = "https://www.netbilling.com/docs/";

export const netbillingManifest: ProviderManifest = {
  id: "netbilling",
  displayName: "NETbilling",
  version: NETBILLING_ADAPTER_VERSION,
  wave: "HR-1",
  researchStatus: "tested",
  // The research also notes aggregation-like behavior for NBCheck (ACH) only,
  // marked tentative; it is not claimed as a category.
  categories: ["gateway", "merchant_account_intermediary"],
  sectors: [
    { sector: "Recurring Memberships", source: ONLINE },
    { sector: "Tangible Products", source: ONLINE },
    { sector: "Service Industries", source: ONLINE },
    { sector: "Healthcare", source: ONLINE },
    { sector: "Travel", source: ONLINE },
    {
      sector: "Gaming (not defined by NETbilling; not stated to mean gambling or iGaming)",
      source: ONLINE,
    },
    { sector: "CBD", source: ONLINE },
    { sector: "Adult", source: ONLINE },
    { sector: "Dating", source: ONLINE },
    { sector: "Retail", source: PROCESSING },
    { sector: "Restaurants", source: PROCESSING },
    { sector: "E-commerce", source: ABOUT },
    { sector: "Legal", source: ABOUT },
    { sector: "Accounting", source: ABOUT },
    { sector: "Call centers", source: ABOUT },
    { sector: "Firearms", source: ABOUT },
    { sector: "Tobacco", source: ABOUT },
    { sector: "Mobile", source: DOCS },
    { sector: "Card-present", source: DOCS },
  ],
  regions:
    "NETbilling states it serves clients in the US, Canada and the EU. NBCheck (ACH) runs on the US ACH network under NACHA rules. Settlement currency is typically USD (DCC is an exception). A list of supported countries, currencies or prohibited business types is not published.",
  documentationAccess: "partial",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Direct Mode 3.2 fixtures follow the documented field table and the shape of the two published response examples; hosted payment form, Member Update and Direct Mode 2.1 fixtures were built from documented field tables because NETbilling publishes no literal examples of them. None is an official NETbilling example.",
  dependencies: [
    "The merchant's own merchant account at an acquiring bank",
    "The configured back-end card processor (routing prefixes such as PTECH, INT/CX or FDR-NASH appear in the processor field)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "netbilling.direct3.response",
      description:
        "Direct Mode 3.2 synchronous transaction response (application/x-www-form-urlencoded status_code, trans_id, auth_msg, ...)",
      status: "supported",
    },
    {
      id: "netbilling.direct3.exception",
      description:
        "Direct Mode 3.2 exception (non-200 HTTP status 6xx/7xx, empty body); decoded from the numeric status only",
      status: "limited",
    },
    {
      id: "netbilling.paymentform.response",
      description:
        "Payment Form 2.2 return / Postback CGI fields with the default Ecom_Ezic_Response_* names",
      status: "experimental",
    },
    {
      id: "netbilling.memberupdate.member",
      description: "Member Update 1.1 GET response (M_MEMBER_STATUS and member identifiers)",
      status: "experimental",
    },
    {
      id: "netbilling.paymentform.emulated",
      description:
        "Hosted form returns in Authorize.Net (x_*) or Verisign (RESULT, PNREF) compatibility mode",
      status: "unsupported",
    },
    {
      id: "netbilling.paymentform.request",
      description: "Hosted payment form request fields (Ecom_Ezic_* without a response status)",
      status: "unsupported",
    },
    {
      id: "netbilling.direct21.response",
      description: "Legacy Direct Mode 2.1 RET_* response",
      status: "unsupported",
    },
    {
      id: "netbilling.directbatch.status",
      description: "Direct Mode Batch 3.2 job status",
      status: "unsupported",
    },
    {
      id: "netbilling.reports.csv",
      description: "Data Retrieval Interface 1.5 and batch settlement CSV",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    paymentResponses: "supported",
    webhookParsing: "experimental",
    timeline: "limited",
    correlation: "limited",
    // Generic and lifecycle rules apply; there are no NETbilling-specific rules.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "index", title: "NETbilling documentation", url: DOCS },
    {
      topic: "direct-mode",
      title: "Direct Mode 3.2",
      url: "https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode3protocol.html",
    },
    {
      topic: "auth-messages",
      title: "Transaction Authorization Message Definitions",
      url: "https://www.netbilling.com/transactional-information-lists/",
    },
    {
      topic: "test-mode",
      title: "Test Mode Responses",
      url: "https://secure.netbilling.com/public/docs/merchant/popup/popup-testmode.html",
    },
    {
      topic: "payment-form",
      title: "Payment Form 2.2",
      url: "https://secure.netbilling.com/public/docs/merchant/public/nativespecs/ezicPaymentForm22.html",
    },
    {
      topic: "member-update",
      title: "Member Update Protocol 1.1",
      url: "https://secure.netbilling.com/public/docs/merchant/public/directmode/mupdate1.1.html",
    },
    {
      topic: "data-retrieval",
      title: "Data Retrieval Interface 1.5",
      url: "https://secure.netbilling.com/public/docs/merchant/public/directmode/repinterface1.5.html",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "Ecom_Ezic_Response_TransactionID and Ecom_Ezic_Response_StatusCode (NETbilling documents no event id; trans_id is unique per transaction)",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Make the postback handler idempotent per transaction ID. NETbilling does not document postback retries, acknowledgement or ordering.",
    docsUrl:
      "https://secure.netbilling.com/public/docs/merchant/public/nativespecs/ezicPaymentForm22.html",
  },
  limitations: [
    "Decline reasons are read from auth_msg, which NETbilling says is processor specific, may change and is not intended to be machine readable. Messages are matched as whole texts (several trailing numbers are reused with different meanings), so every auth_msg decoding has at most possible confidence; unmatched texts are reported as unknown with insufficient confidence.",
    "The meanings of avs_code, cvv2_code and reason_code2 are only available behind the NETbilling merchant login; their values are shown but not decoded.",
    "NETbilling says unexpected status_code values other than 0 and F should be treated as success. PandaPayLens does not follow that for analysis: unknown status codes are reported with an unknown outcome.",
    "status_code=T with auth_msg OFFLINE RECORD and a 3ds_url means a 3-D Secure 2 challenge is pending and nothing was authorized; it is shown as pending authentication. OFFLINE RECORD without a 3ds_url is shown with an unknown outcome.",
    "status_code=D returns the original transaction's trans_id; Direct Mode 3.2 does not say whether the original was approved, so the duplicate response has an unknown outcome.",
    "Direct Mode 3.2 responses do not say which operation (auth, sale, capture, refund, credit, undo) produced them and do not echo orig_id or any merchant reference. status_code=1 is shown with the generic stage payment, and refunds or captures cannot be linked to their parent transaction from the response alone.",
    "Direct Mode exceptions are non-200 HTTP statuses with an empty body; the error text and the 5-digit sub-code of 699/799 are only in the HTTP reason phrase. PandaPayLens core keeps only the numeric status and rejects HTTP messages with an empty body, so pasted exceptions cannot be analyzed from text today; when such a record reaches the adapter it is decoded by status range only. Only 604 and 699 sub-code 20112 are documented.",
    "Test mode is recognized only when auth_msg starts with TEST. The documented amount rules (tens digit: approve or decline, hundreds digit: AVS letter, thousands digit: CVV2 letter) are shown as expectations for amounts below 10000; whole-thousand amounts and amounts of 10000 or more are not explained further in the documentation. Fraud controls also run in test mode.",
    "The Postback CGI is experimental: NETbilling publishes no example body, content type, acknowledgement, retry, ordering or source IP rules, and field names and encodings are configurable per payment form. Only the default Ecom_Ezic_Response_* names are analyzed. The return URL redirect carries the same fields and cannot be told apart from the postback.",
    "Whether rebills, refunds, chargebacks, cancellations or expirations produce postbacks is not documented. No analyzed format marks a charge as a rebill, so isRecurring is only set to false for documented signups.",
    "The postback delivery key is the transaction ID plus status code; NETbilling documents no event id and no duplicate delivery behavior. Ecom_Ezic_Response_IssueDate has no documented format and is not used as event time. Ecom_Cost_Total has no documented currency, so hosted form amounts are not normalized.",
    "Member Update 1.1 GET responses are experimental: only M_MEMBER_STATUS and the member, signup and template identifiers are documented in the research. Member statuses are shown with stage subscription; their outcome reflects the reported membership state, not a payment.",
    "Hosted form returns in Authorize.Net (x_*) or Verisign (RESULT, PNREF) compatibility mode are not attributed to NETbilling unless an Ecom_Ezic_* field is present, and even then are not analyzed: NETbilling's encoding of their values is not documented.",
    "Data Retrieval Interface CSV reports, batch settlement CSV, Direct Mode Batch, Direct Mode 2.1 and Control CGI posts are not analyzed. Chargeback (dispute) data and recurring billing statuses exist only in those reports.",
    "The hosted form signature (Ecom_Ezic_ProofOfPurchase_MD5), request hashes, access keywords, 3ds_creq and card, bank and member credential fields are never copied or verified; a pasted postback is never treated as authentic.",
    "Categories: gateway and merchant account intermediary. NETbilling's NBCheck (ACH) underwriting is aggregation-like, but the research marks this as tentative and NETbilling does not call itself a payment facilitator, so it is not claimed.",
  ],
  samples: ["netbilling-decline", "netbilling-3ds-pending"],
};
