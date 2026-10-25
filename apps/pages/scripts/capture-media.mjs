// Captures README screenshots and the GitHub social preview from the static
// export (synthetic sample data only). Run after `pnpm build:pages`:
//   node apps/pages/scripts/capture-media.mjs
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { MANIFESTS } from "@pandapaylens/providers/manifests";
import { socialCardHtml } from "./social-card.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const media = fileURLToPath(new URL("../../../docs/media/", import.meta.url));
mkdirSync(media, { recursive: true });
const port = 3299;
const base = `http://localhost:${port}/PandaPayLens/`;

const server = spawn(process.execPath, [`${here}serve.mjs`], {
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch();
try {
  const shot = async (path, file, { theme = "light", width = 1440, height = 900, action } = {}) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      colorScheme: theme,
    });
    const page = await ctx.newPage();
    await page.addInitScript((t) => localStorage.setItem("ppl-theme", t), theme);
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
    if (action) await action(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: media + file });
    await ctx.close();
    console.log(`[media] ${file}`);
  };

  await shot("", "home-light.png");
  await shot("", "home-dark.png", { theme: "dark" });
  await shot("analyze/?sample=stripe-insufficient-funds", "decoder-light.png", {
    action: (p) => p.getByRole("heading", { name: "card_declined" }).waitFor(),
  });
  await shot("analyze/?sample=adyen-duplicate-conflict", "timeline-dark.png", {
    theme: "dark",
    action: async (p) => {
      await p.getByRole("tabpanel").getByText("Showing").waitFor();
      await p
        .getByRole("button", { name: /CAPTURE/ })
        .first()
        .click();
    },
  });

  // Social preview (1280x640). The provider count comes from the registry.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 640 } });
  const page = await ctx.newPage();
  const logo = readFileSync(
    fileURLToPath(new URL("../../web/app/icon.svg", import.meta.url)),
    "utf8",
  );
  await page.setContent(socialCardHtml({ logo, providers: MANIFESTS.length }), {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${media}social-preview.png` });
  await ctx.close();
  console.log("[media] social-preview.png");
} finally {
  await browser.close();
  server.kill();
}
