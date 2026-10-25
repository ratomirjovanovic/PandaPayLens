// Captures README screenshots and the GitHub social preview from the static
// export (synthetic sample data only). Run after `pnpm build:pages`:
//   node apps/pages/scripts/capture-media.mjs
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

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

  // Social preview (1280x640): rendered from a small HTML card.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 640 } });
  const page = await ctx.newPage();
  const logo = readFileSync(
    fileURLToPath(new URL("../../web/app/icon.svg", import.meta.url)),
    "utf8",
  );
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:640px;background:#0f1115;color:#ecedf0;font-family:Segoe UI,system-ui,sans-serif;display:flex;align-items:center;">
  <div style="padding:0 80px;flex:1">
    <div style="display:flex;align-items:center;gap:24px"><div style="width:132px;height:132px;background:#ffffff;border-radius:28px;display:flex;align-items:center;justify-content:center"><div style="width:112px">${logo}</div></div>
    <div style="font-size:72px;font-weight:700">Panda<span style="color:#3fcf8e">PayLens</span></div></div>
    <p style="font-size:34px;line-height:1.35;margin:36px 0 0;max-width:680px">Decode payment errors. Visualize transaction events. Understand what went wrong.</p>
    <p style="font-size:22px;color:#a2a7b3;margin-top:28px">Open source · local-first · runs in your browser</p>
  </div>
  <div style="width:400px;margin-right:80px;background:#171a21;border:1px solid #2a2f39;border-radius:16px;padding:28px;font-family:Consolas,monospace;font-size:19px;line-height:1.9">
    <div><span style="color:#4ade80">●</span> payment_intent.created</div>
    <div><span style="color:#4ade80">●</span> charge.succeeded</div>
    <div><span style="color:#4ade80">●</span> payment_intent.succeeded</div>
    <div><span style="color:#f2b84b">●</span> delivered 2 times <span style="color:#a2a7b3">(info)</span></div>
    <div style="margin-top:14px;color:#a2a7b3">decline_code</div>
    <div>insufficient_funds</div>
  </div></body></html>`);
  await page.screenshot({ path: `${media}social-preview.png` });
  await ctx.close();
  console.log("[media] social-preview.png");
} finally {
  await browser.close();
  server.kill();
}
