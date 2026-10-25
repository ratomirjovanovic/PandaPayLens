import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, not built output.
    alias: [
      { find: /^@pandapaylens\/core$/, replacement: src("./packages/core/src/index.ts") },
      {
        find: /^@pandapaylens\/stripe$/,
        replacement: src("./packages/adapters/stripe/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/adyen$/,
        replacement: src("./packages/adapters/adyen/src/index.ts"),
      },
      { find: /^@pandapaylens\/rules$/, replacement: src("./packages/rules/src/index.ts") },
      { find: /^@pandapaylens\/providers$/, replacement: src("./packages/providers/src/index.ts") },
      {
        find: /^@pandapaylens\/stripe\/manifest$/,
        replacement: src("./packages/adapters/stripe/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/adyen\/manifest$/,
        replacement: src("./packages/adapters/adyen/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/payabl\/manifest$/,
        replacement: src("./packages/adapters/payabl/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/payabl$/,
        replacement: src("./packages/adapters/payabl/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/checkout\/manifest$/,
        replacement: src("./packages/adapters/checkout/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/checkout$/,
        replacement: src("./packages/adapters/checkout/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/paypal\/manifest$/,
        replacement: src("./packages/adapters/paypal/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/paypal$/,
        replacement: src("./packages/adapters/paypal/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/braintree\/manifest$/,
        replacement: src("./packages/adapters/braintree/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/braintree$/,
        replacement: src("./packages/adapters/braintree/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/mollie\/manifest$/,
        replacement: src("./packages/adapters/mollie/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/mollie$/,
        replacement: src("./packages/adapters/mollie/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/square\/manifest$/,
        replacement: src("./packages/adapters/square/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/square$/,
        replacement: src("./packages/adapters/square/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/verotel\/manifest$/,
        replacement: src("./packages/adapters/verotel/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/verotel$/,
        replacement: src("./packages/adapters/verotel/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/netbilling\/manifest$/,
        replacement: src("./packages/adapters/netbilling/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/netbilling$/,
        replacement: src("./packages/adapters/netbilling/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/pxp\/manifest$/,
        replacement: src("./packages/adapters/pxp/src/manifest.ts"),
      },
      { find: /^@pandapaylens\/pxp$/, replacement: src("./packages/adapters/pxp/src/index.ts") },
      {
        find: /^@pandapaylens\/ccbill\/manifest$/,
        replacement: src("./packages/adapters/ccbill/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/ccbill$/,
        replacement: src("./packages/adapters/ccbill/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/segpay\/manifest$/,
        replacement: src("./packages/adapters/segpay/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/segpay$/,
        replacement: src("./packages/adapters/segpay/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/trust-payments\/manifest$/,
        replacement: src("./packages/adapters/trust-payments/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/trust-payments$/,
        replacement: src("./packages/adapters/trust-payments/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/emerchantpay\/manifest$/,
        replacement: src("./packages/adapters/emerchantpay/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/emerchantpay$/,
        replacement: src("./packages/adapters/emerchantpay/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/ecommpay\/manifest$/,
        replacement: src("./packages/adapters/ecommpay/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/ecommpay$/,
        replacement: src("./packages/adapters/ecommpay/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/paymentwall\/manifest$/,
        replacement: src("./packages/adapters/paymentwall/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/paymentwall$/,
        replacement: src("./packages/adapters/paymentwall/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/nmi\/manifest$/,
        replacement: src("./packages/adapters/nmi/src/manifest.ts"),
      },
      { find: /^@pandapaylens\/nmi$/, replacement: src("./packages/adapters/nmi/src/index.ts") },
      {
        find: /^@pandapaylens\/mifinity\/manifest$/,
        replacement: src("./packages/adapters/mifinity/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/mifinity$/,
        replacement: src("./packages/adapters/mifinity/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/astropay\/manifest$/,
        replacement: src("./packages/adapters/astropay/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/astropay$/,
        replacement: src("./packages/adapters/astropay/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/finrax\/manifest$/,
        replacement: src("./packages/adapters/finrax/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/finrax$/,
        replacement: src("./packages/adapters/finrax/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/inpay\/manifest$/,
        replacement: src("./packages/adapters/inpay/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/inpay$/,
        replacement: src("./packages/adapters/inpay/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/decta\/manifest$/,
        replacement: src("./packages/adapters/decta/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/decta$/,
        replacement: src("./packages/adapters/decta/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/trustly\/manifest$/,
        replacement: src("./packages/adapters/trustly/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/trustly$/,
        replacement: src("./packages/adapters/trustly/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/skrill\/manifest$/,
        replacement: src("./packages/adapters/skrill/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/skrill$/,
        replacement: src("./packages/adapters/skrill/src/index.ts"),
      },
      {
        find: /^@pandapaylens\/ezeewallet\/manifest$/,
        replacement: src("./packages/adapters/ezeewallet/src/manifest.ts"),
      },
      {
        find: /^@pandapaylens\/ezeewallet$/,
        replacement: src("./packages/adapters/ezeewallet/src/index.ts"),
      },
      { find: /^@\/(.*)$/, replacement: `${src("./apps/web/")}$1` },
    ],
  },
  test: {
    include: ["packages/**/tests/**/*.test.ts", "apps/web/tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**", "packages/adapters/*/src/**"],
      exclude: ["packages/cli/src/bin.ts"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
