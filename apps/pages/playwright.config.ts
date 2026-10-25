import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3200);

/** Smoke tests against the static export, served under the GitHub Pages base path. */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.PAGES_URL ?? `http://localhost:${PORT}/PandaPayLens/`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  // Against a deployed site (PAGES_URL), no local server is started.
  webServer: process.env.PAGES_URL
    ? undefined
    : {
        command: "node scripts/serve.mjs",
        url: `http://localhost:${PORT}/PandaPayLens/`,
        reuseExistingServer: !process.env.CI,
      },
});
