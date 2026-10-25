import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, not built output.
    alias: {
      "@pandapaylens/core": src("./packages/core/src/index.ts"),
      "@pandapaylens/stripe": src("./packages/adapters/stripe/src/index.ts"),
      "@pandapaylens/adyen": src("./packages/adapters/adyen/src/index.ts"),
      "@pandapaylens/rules": src("./packages/rules/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**", "packages/adapters/*/src/**"],
      exclude: ["packages/cli/src/bin.ts"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
