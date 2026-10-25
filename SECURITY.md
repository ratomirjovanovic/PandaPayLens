# Security Policy

## Supported versions

| Version             | Supported |
| ------------------- | --------- |
| 0.1.x (pre-release) | Yes       |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on https://github.com/ratomirjovanovic/PandaPayLens/security.

Include:

- the affected component (web analyzer, core package, adapter, CLI),
- steps to reproduce, using synthetic data only,
- the impact you expect.

Never include real card numbers, customer data or provider credentials in a report.

## What happens next

1. We acknowledge the report within 5 working days.
2. We assess it and agree on severity with you.
3. We prepare a fix privately and release it as soon as practical.
4. We publish an advisory after the fix is available and credit you if you wish.

We follow coordinated disclosure. We won't ask you to disclose publicly before the issue is assessed and fixed, and we ask that you give us reasonable time to do so.

## Scope

Particularly relevant:

- imported payload data leaving the browser,
- sensitive data appearing in exports, logs or storage,
- script injection through imported JSON,
- resource exhaustion from crafted input,
- authentication or authorization bypass in administrative features (once released).

## Security claims

PandaPayLens is not PCI DSS certified and has not had an independent penetration test. Documentation describes only controls that are implemented and tested in this repository.
