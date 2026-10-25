# Roadmap

This is the public plan for PandaPayLens. It lists work that is planned or under way, not promises with dates. The live provider status is always on the [providers page](https://ratomirjovanovic.github.io/PandaPayLens/providers/), and finished work is in the [changelog](CHANGELOG.md).

Ideas and feedback are welcome in [Discussions](https://github.com/ratomirjovanovic/PandaPayLens/discussions). Concrete work is tracked in [issues](https://github.com/ratomirjovanovic/PandaPayLens/issues) and grouped by [milestone](https://github.com/ratomirjovanovic/PandaPayLens/milestones).

## Released

| Version | Highlights                                                                                               |
| ------- | -------------------------------------------------------------------------------------------------------- |
| 0.1.0   | Analyzer, Stripe and Adyen, wave 1 providers, CLI, GitHub Pages demo, optional admin area                |
| 0.2.0   | High-risk wave HR-1: CCBill, Segpay, Verotel, NETbilling, PXP Financial, Trust Payments; lifecycle rules |
| 0.3.0   | High-risk wave HR-2: emerchantpay, Ecommpay, Paymentwall, NMI, MiFinity, AstroPay, Skrill, eZeeWallet    |
| 0.4.0   | High-risk wave HR-3: Finrax, Inpay, DECTA, Trustly                                                       |
| 0.5.0   | Research for Worldpay, Cybersource, Authorize.net and Nuvei; plain-text HTTP error bodies                |
| 0.6.0   | Wave 2 adapters: Worldpay, Cybersource, Authorize.net, Nuvei                                             |
| 0.7.0   | Wave 3 adapters: Paysafe, Airwallex, Rapyd, dLocal, EBANX                                                |

## In progress

- Nothing large right now. Smaller items are tracked as [issues](https://github.com/ratomirjovanovic/PandaPayLens/issues).

## Planned

### Providers

- **General providers with verified documentation, adapters next:** BlueSnap (JSON Payment API and webhooks), PayU India (form-encoded responses and webhooks, Verify Payment JSON), Razorpay (Payments API and webhooks), Paystack (Transactions API and webhooks) and Flutterwave (v3 API and webhooks).
- **Blocked:** Pavilion Payments and Epoch publish no developer documentation without a merchant relationship. They stay listed as blocked until that changes.

### Analyzer

- XML input for providers that answer in XML (parts of emerchantpay, Skrill and payabl.). Today XML is reported as an unsupported format.
- Plain `key: value` text responses used by some legacy APIs.
- Keyboard navigation between timeline events ([#3](https://github.com/ratomirjovanovic/PandaPayLens/issues/3)).

### CLI and packages

- `--output <file>` for reports ([#4](https://github.com/ratomirjovanovic/PandaPayLens/issues/4)).
- Publishing the CLI and core packages to npm.

### Documentation

- More worked examples of common failure patterns on the website and in the [wiki](https://github.com/ratomirjovanovic/PandaPayLens/wiki).

## Not planned

- Calling payment providers, storing payment data or acting as a payment service.
- Verifying webhook signatures with merchant secrets.
- Recommending or rating providers for merchants.
