import { expect, test, type Request } from "@playwright/test";

/**
 * Privacy regression (release blocker): importing and analyzing local JSON
 * must not transmit its content anywhere. Unique marker values are planted
 * in the payload and must not appear in any request, and no request may go
 * to another origin.
 */
const MARKERS = [
  "PPL-PRIVACY-MARKER-7f3c9a",
  "pi_PPLprivacyMarker8b21",
  "PPLMARKERPSP0001",
  "privacy.marker.4d2e@example.net",
];

const payload = JSON.stringify([
  {
    id: "evt_PPLprivacy0001",
    object: "event",
    created: 1761379200,
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: MARKERS[1],
        object: "payment_intent",
        status: "requires_payment_method",
        description: MARKERS[0],
        receipt_email: MARKERS[3],
        last_payment_error: {
          type: "card_error",
          code: "card_declined",
          decline_code: "generic_decline",
          message: MARKERS[0],
        },
      },
    },
  },
  {
    notificationItems: [
      {
        NotificationRequestItem: {
          eventCode: "AUTHORISATION",
          success: "false",
          pspReference: MARKERS[2],
          merchantReference: MARKERS[0],
          reason: "Refused",
        },
      },
    ],
  },
]);

test("analyzing and exporting does not transmit imported data", async ({ page, baseURL }) => {
  const requests: Request[] = [];
  const consoleText: string[] = [];
  page.on("request", (r) => requests.push(r));
  page.on("console", (m) => consoleText.push(m.text()));

  await page.goto("/analyze");
  await page.waitForLoadState("networkidle");
  const before = requests.length;

  await page.getByLabel("Payment JSON").fill(payload);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("payment_intent.payment_failed");

  // Exercise the other views and the exports too.
  await page.getByRole("tab", { name: "Data inspector" }).click();
  await page.getByRole("tab", { name: "Error decoder" }).click();
  await page.getByRole("checkbox", { name: "Show full identifiers" }).check();
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Markdown", exact: true }).click(),
  ]);
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PNG timeline" }).click(),
  ]);
  await page.waitForLoadState("networkidle");

  const origin = new URL(baseURL!).origin;
  for (const r of requests) {
    const url = r.url();
    if (url.startsWith("blob:") || url.startsWith("data:")) continue;
    expect(new URL(url).origin, `request to another origin: ${url}`).toBe(origin);
    const body = r.postData() ?? "";
    for (const m of MARKERS) {
      expect(decodeURIComponent(url)).not.toContain(m);
      expect(body).not.toContain(m);
    }
    for (const value of Object.values(r.headers()))
      for (const m of MARKERS) expect(value).not.toContain(m);
  }
  // Analysis needs no request beyond loading code chunks.
  const nonGet = requests.slice(before).filter((r) => r.method() !== "GET");
  expect(nonGet.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  for (const line of consoleText) for (const m of MARKERS) expect(line).not.toContain(m);
});

test("imported data is not persisted in browser storage", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByLabel("Payment JSON").fill(payload);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("payment_intent.payment_failed");

  const stored = await page.evaluate(async () => {
    const dump: string[] = [document.cookie];
    for (let i = 0; i < localStorage.length; i++)
      dump.push(localStorage.getItem(localStorage.key(i)!) ?? "");
    for (let i = 0; i < sessionStorage.length; i++)
      dump.push(sessionStorage.getItem(sessionStorage.key(i)!) ?? "");
    const dbs = (await indexedDB.databases?.()) ?? [];
    dump.push(JSON.stringify(dbs));
    return dump.join("\n");
  });
  for (const m of MARKERS) expect(stored).not.toContain(m);

  await page.reload();
  await expect(page.getByLabel("Payment JSON")).toHaveValue("");
});

test("the analysis worker runs under its own restrictive CSP", async ({ page }) => {
  const workerUrl = new Promise<string>((resolve) => page.on("worker", (w) => resolve(w.url())));
  await page.goto("/analyze");
  await page.getByLabel("Payment JSON").fill(payload);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("payment_intent.payment_failed");

  // A worker ignores the page CSP and follows the one on its script response.
  const res = await page.request.get((await workerUrl).split("#")[0]!);
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("connect-src 'self'");
});
