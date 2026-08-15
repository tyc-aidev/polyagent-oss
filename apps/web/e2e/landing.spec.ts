import { expect, test } from "@playwright/test";

test("landing page CTAs and sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /prediction-market/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open dashboard/i }).first()).toHaveAttribute(
    "href",
    "/markets",
  );
  await expect(page.getByRole("link", { name: /view demo/i }).first()).toHaveAttribute(
    "href",
    "/demo",
  );
  await expect(page.locator("#features")).toBeVisible();
  await expect(page.locator("#how-it-works")).toBeVisible();
  await expect(page.locator("#faq")).toBeVisible();
});
