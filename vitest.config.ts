import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, not built output.
    alias: [
      { find: "@pandapaylens/core", replacement: src("./packages/core/src/index.ts") },
      { find: "@pandapaylens/stripe", replacement: src("./packages/adapters/stripe/src/index.ts") },
      { find: "@pandapaylens/adyen", replacement: src("./packages/adapters/adyen/src/index.ts") },
      { find: "@pandapaylens/rules", replacement: src("./packages/rules/src/index.ts") },
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
