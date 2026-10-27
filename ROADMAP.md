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
| 0.8.0   | Wave 4 adapters: BlueSnap, PayU India, Razorpay, Paystack, Flutterwave                                   |
| 0.9.0   | Analyzer UX and redaction                                                                                |
| 0.10.0  | Repeated records recognized without delivery ids                                                         |
| 0.11.0  | XML input; XML for emerchantpay, Skrill, Authorize.net, BlueSnap, Inpay                                  |
| 0.12.0  | Worldpay XML, time zone handling, documentation links for every provider                                 |
| 0.13.0  | Plain `name: value` text, Verotel FlexPay status page                                                    |
| 0.14.0  | npm package `pandapaylens` (CLI and library)                                                             |
| 0.15.0  | Source available under the Elastic License 2.0; demo video                                               |

## In progress

- Nothing large right now. Smaller items are tracked as [issues](https://github.com/ratomirjovanovic/PandaPayLens/issues).

## Planned

### Providers

- **Every documented roadmap provider is implemented.** New providers are added on request through a "New provider" issue with links to official developer documentation.
- **Blocked:** Pavilion Payments and Epoch publish no developer documentation without a merchant relationship. They stay listed as blocked until that changes.

### Analyzer

- Keyboard navigation between timeline events ([#3](https://github.com/ratomirjovanovic/PandaPayLens/issues/3)).

### CLI and packages

- `--output <file>` for reports ([#4](https://github.com/ratomirjovanovic/PandaPayLens/issues/4)).

### Documentation

- More worked examples of common failure patterns on the website and in the [wiki](https://github.com/ratomirjovanovic/PandaPayLens/wiki).

## Not planned

- Calling payment providers, storing payment data or acting as a payment service.
- Verifying webhook signatures with merchant secrets.
- Recommending or rating providers for merchants.
