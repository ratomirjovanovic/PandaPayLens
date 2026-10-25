import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const fixture = (p: string) =>
  readFileSync(new URL(`../../../../fixtures/${p}`, import.meta.url), "utf8");

async function paste(page: Page, text: string) {
  await page.getByLabel("Payment JSON").fill(text);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
}

test("home page links to the analyzer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand what went wrong");
  await page.getByRole("link", { name: "Open the analyzer" }).click();
  await expect(page).toHaveURL(/\/analyze$/);
});

test("decodes a Stripe example from the examples page", async ({ page }) => {
  await page.goto("/examples");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Stripe: insufficient funds" })
    .getByRole("link")
    .click();
  const decoder = page.getByRole("tabpanel");
  await expect(page.getByRole("tab", { name: "Error decoder" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(decoder.getByRole("heading", { name: "card_declined" })).toBeVisible();
  await expect(decoder).toContainText("Insufficient funds");
  await expect(decoder).toContainText("Customer action required");
  await expect(decoder).toContainText("pi_••••0001");
  await expect(decoder).not.toContainText("pi_3PPLsynthNSF00001");
});

test("shows the timeline, filters events and highlights evidence", async ({ page }) => {
  await page.goto("/analyze?sample=stripe-out-of-order");
  await expect(page.getByRole("tab", { name: "Timeline" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("button", { name: /payment_intent\.created/ })).toBeVisible();
  await expect(panel).toContainText("Showing 3 of 3 events");

  await panel.getByLabel("Event type").selectOption("charge.succeeded");
  await expect(panel).toContainText("Showing 1 of 3 events");
  await panel.getByRole("button", { name: "Reset filters" }).click();

  await panel.getByRole("button", { name: /charge\.succeeded/ }).click();
  await expect(panel.getByText("Receipt time")).toBeVisible();

  await page.getByRole("button", { name: /Show 3 event/ }).click();
  await expect(page.locator("#event-ev-1 .ring-2")).toBeVisible();
});

test("filters findings by severity", async ({ page }) => {
  await page.goto("/analyze?sample=adyen-duplicate-conflict");
  const findings = page.getByRole("complementary");
  await expect(findings).toContainText("4 of 4 finding(s)");
  await findings.getByLabel("Severity").selectOption("info");
  await expect(findings).toContainText("1 of 4 finding(s)");
  await expect(findings.getByRole("heading", { name: /delivered 2 times/ })).toBeVisible();
});

test("exports a masked JSON report and a PNG", async ({ page }) => {
  await page.goto("/analyze?sample=stripe-success");
  await expect(page.getByRole("tabpanel")).toContainText("payment_intent.succeeded");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON", exact: true }).click(),
  ]);
  const report = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(report.tool).toBe("PandaPayLens");
  expect(report.redaction.identifiersMasked).toBe(true);
  const raw = JSON.stringify(report);
  expect(raw).not.toContain("pi_3PPLsynthOK000001");
  expect(raw).not.toMatch(/PPLsyntheticSecret|synthetic\.customer@example\.com/);

  const [png] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PNG timeline" }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
});

test("reports invalid JSON with line and column", async ({ page }) => {
  await page.goto("/analyze");
  await paste(page, '{\n  "a": 1,\n  "b": }');
  await expect(page.getByRole("alert").filter({ hasText: "not valid JSON" })).toContainText(
    "line 3, column",
  );
});

test("explains unsupported input", async ({ page }) => {
  await page.goto("/analyze");
  await paste(page, fixture("malformed/unknown-provider-error.json"));
  await expect(page.getByRole("complementary")).toContainText("UNSUPPORTED_RECORD");
});

test("switches and persists the theme", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("is operable with the keyboard", async ({ page }) => {
  await page.goto("/analyze");
  const editor = page.getByLabel("Payment JSON");
  await editor.focus();
  await page.keyboard.insertText(fixture("stripe/insufficient-funds.json"));
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("heading", { name: /^Results/ })).toBeFocused();
  await page.getByRole("tab", { name: "Error decoder" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Timeline" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Timeline" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("renders hostile payload values as text", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    void d.dismiss();
  });
  await page.goto("/analyze");
  await paste(page, fixture("malformed/xss.json"));
  await expect(page.getByRole("tabpanel")).toContainText("<img src=x onerror=alert(1)>");
  await page.getByRole("tab", { name: "Data inspector" }).click();
  await page.getByRole("tab", { name: "Timeline" }).click();
  expect(dialogs).toBe(0);
  expect(await page.locator("main img, main svg[onload]").count()).toBe(0);
});

test("serves a restrictive Content-Security-Policy", async ({ request }) => {
  const res = await request.get("/analyze");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["referrer-policy"]).toBe("no-referrer");
});

test("admin routes are not available to anonymous users", async ({ request }) => {
  for (const path of ["/admin", "/admin/users", "/api/admin/dashboard"]) {
    const res = await request.get(path);
    expect([401, 403, 404]).toContain(res.status());
  }
});

test("public API endpoints return sanitized metadata", async ({ request }) => {
  const health = await (await request.get("/api/health")).json();
  expect(Object.keys(health).sort()).toEqual(["status", "version"]);
  const providers = await (await request.get("/api/providers")).json();
  const ids = providers.providers.map((p: { id: string }) => p.id);
  expect(ids).toEqual(
    expect.arrayContaining(["stripe", "adyen", "payabl", "checkout", "paypal", "mollie", "square"]),
  );
});

test("provider directory lists all roadmap providers honestly and filters them", async ({
  page,
}) => {
  await page.goto("/providers");
  await expect(page.getByText(/of 42 providers$/)).toBeVisible();
  await page.getByLabel("Status").selectOption("planned");
  const planned = page.getByRole("listitem").filter({ hasText: "Not implemented yet" });
  expect(await planned.count()).toBeGreaterThan(0);
  await page.getByLabel("Status").selectOption("");
  await page.getByLabel("Category").selectOption("high_risk");
  await expect(page.getByText("20 of 42 providers")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "CCBill" })).toContainText("limited");
  await expect(page.getByRole("listitem").filter({ hasText: "Trustly" })).toContainText("limited");
  await expect(page.getByRole("listitem").filter({ hasText: "Epoch" })).toContainText("blocked");
  await page.getByLabel("Category").selectOption("");
  await page.getByLabel("Provider", { exact: true }).fill("stripe");
  await expect(page.getByText("1 of 42 providers")).toBeVisible();
  await page.getByRole("link", { name: "Details" }).click();
  await expect(page).toHaveURL(/\/providers\/stripe$/);
  await expect(page.getByRole("heading", { name: "Capabilities" })).toBeVisible();
});

test("analyzes a form-encoded payabl. example", async ({ page }) => {
  await page.goto("/analyze?sample=payabl-insufficient-funds");
  await expect(page.getByRole("list", { name: "Detected input" })).toContainText("payabl.");
  await expect(page.getByRole("tabpanel")).toContainText("Insufficient funds", {
    ignoreCase: true,
  });
});

test("high-risk context: grouped examples and the operation filter", async ({ page }) => {
  await page.goto("/examples");
  await expect(page.getByRole("heading", { name: "High-risk payments" })).toBeVisible();
  await page.goto("/analyze?sample=verotel-subscription-log");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("rebill");
  await panel.getByLabel("Operation").selectOption("recurring");
  await expect(panel.getByRole("button", { name: /rebill/ }).first()).toBeVisible();
  await expect(panel.getByRole("button", { name: /^.*initial/ })).toHaveCount(0);
});

test("groups the provider list by support level", async ({ page }) => {
  await page.goto("/analyze");
  const select = page.getByRole("combobox", { name: "Provider" });
  await expect(
    select.locator('optgroup[label="Full support"] option', { hasText: "Stripe" }),
  ).toHaveCount(1);
  await expect(
    select.locator('optgroup[label="Limited support"] option', { hasText: "DECTA" }),
  ).toHaveCount(1);
  await expect(select.locator("option", { hasText: "(limited)" })).toHaveCount(0);
});

test("offers to analyze a record as the provider it resembles", async ({ page }) => {
  await page.goto("/analyze");
  await paste(page, fixture("decta/refund-text-error.txt"));
  const button = page.getByRole("button", { name: "Analyze as DECTA" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole("combobox", { name: "Provider" })).toHaveValue("decta");
  await expect(page.getByRole("list", { name: "Detected input" })).toContainText(
    "decta.text_error",
  );
  await expect(page.getByRole("button", { name: "Analyze as DECTA" })).toHaveCount(0);
  // Official documentation links are shown for every provider, not only Stripe and Adyen.
  await expect(page.getByRole("link", { name: /DECTA documentation/ })).toHaveAttribute(
    "href",
    /^https:\/\/gate\.decta\.com\//,
  );
});
