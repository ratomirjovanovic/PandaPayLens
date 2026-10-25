import { expect, test } from "@playwright/test";

test("analyzer stacks panels on mobile without horizontal scrolling", async ({ page }) => {
  await page.goto("/analyze?sample=adyen-capture-refund");
  await expect(page.getByRole("tabpanel")).toContainText("CAPTURE");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("navigation", { name: "Main (mobile)" })).toBeVisible();
});
