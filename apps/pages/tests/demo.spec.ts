import { readFileSync } from "node:fs";
import { expect, test, type Request } from "@playwright/test";

// Paths are relative to the base URL (…/PandaPayLens/), as on GitHub Pages.

test("home page explains the product and loads assets under the base path @mobile", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand what went wrong");
  await expect(page.getByRole("link", { name: "Try a failed payment" })).toBeVisible();
  expect(failed).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("demo video is served from the site and is not downloaded before play", async ({ page }) => {
  const videos: string[] = [];
  page.on("request", (r) => r.url().endsWith(".mp4") && videos.push(r.url()));
  await page.goto("./");
  const video = page.getByLabel("PandaPayLens demo video");
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute("preload", "none");
  await page.waitForLoadState("networkidle");
  expect(videos).toEqual([]);
  const origin = new URL(page.url()).origin;
  for (const src of [
    await video.getAttribute("poster"),
    await video.locator("source").getAttribute("src"),
  ]) {
    const url = new URL(src ?? "", page.url());
    expect(url.origin).toBe(origin);
    const res = await page.request.get(url.href);
    expect(res.status(), url.pathname).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^(video\/mp4|image\/jpeg)/);
  }
});

test("Try a failed payment decodes the error with next steps", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Try a failed payment" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "card_declined" })).toBeVisible();
  await expect(panel).toContainText("Insufficient funds");
  await expect(panel).toContainText("Suggested next step");
  await expect(page.getByRole("list", { name: "Detected input" })).toContainText("Stripe");
});

test("Explore duplicate webhooks reports the duplicate without claiming double processing", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Explore duplicate webhooks" }).click();
  const findings = page.getByRole("complementary");
  await expect(findings).toContainText("delivered 2 times");
  await expect(findings).toContainText("not necessarily an application bug");
  await expect(findings).toContainText(
    "cannot show whether your application processed the event more than once",
  );
  await expect(page.getByRole("tabpanel")).toContainText("payment_intent.succeeded");
});

test("form-encoded payabl. example and filters work", async ({ page }) => {
  await page.goto("analyze/?sample=payabl-insufficient-funds");
  await expect(page.getByRole("list", { name: "Detected input" })).toContainText("payabl.");
  await page.goto("analyze/?sample=stripe-out-of-order");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Showing 3 of 3 events");
  await panel.getByLabel("Event type").selectOption("charge.succeeded");
  await expect(panel).toContainText("Showing 1 of 3 events");
});

test("exports a masked report", async ({ page }) => {
  await page.goto("analyze/?sample=stripe-success");
  await expect(page.getByRole("tabpanel")).toContainText("payment_intent.succeeded");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON", exact: true }).click(),
  ]);
  const report = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(report.redaction.identifiersMasked).toBe(true);
  expect(JSON.stringify(report)).not.toContain("pi_3PPLsynthOK000001");
});

test("theme switching persists across reloads", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("radio", { name: "Dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("direct loads and refreshes of static routes work", async ({ page }) => {
  for (const path of [
    "providers/",
    "providers/stripe/",
    "providers/payabl/",
    "docs/",
    "docs/security/",
    "examples/",
    "changelog/",
    "about/",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await page.reload();
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("admin and API routes do not exist; unknown paths return the 404 page", async ({ page }) => {
  for (const path of ["admin/", "admin/login/", "api/health"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("imported data is not transmitted anywhere", async ({ page }) => {
  const MARKER = "PPL-PAGES-PRIVACY-MARKER-91c2";
  const requests: Request[] = [];
  page.on("request", (r) => requests.push(r));
  await page.goto("analyze/");
  const payload = JSON.stringify({
    error: {
      type: "card_error",
      code: "card_declined",
      message: MARKER,
      payment_intent: { id: `pi_${MARKER}` },
    },
  });
  await page.getByLabel("Payment JSON").fill(payload);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("card_declined");
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Markdown", exact: true }).click(),
  ]);
  const origin = new URL(page.url()).origin;
  for (const r of requests) {
    if (r.url().startsWith("blob:") || r.url().startsWith("data:")) continue;
    expect(new URL(r.url()).origin).toBe(origin);
    expect(decodeURIComponent(r.url())).not.toContain(MARKER);
    expect(r.postData() ?? "").not.toContain(MARKER);
  }
  const stored = await page.evaluate(
    () =>
      JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie,
  );
  expect(stored).not.toContain(MARKER);
});
