import { expect, test } from "@playwright/test";

test("demo page shows seed bot and links to detail", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: /demo/i })).toBeVisible();
  const details = page.getByRole("link", { name: /view details/i });
  if (await details.isVisible()) {
    await details.click();
    await expect(page).toHaveURL(/\/bots\//);
    await expect(page.getByText(/cash/i).first()).toBeVisible();
  }
});

test("new bot form requires name and markets", async ({ page }) => {
  await page.goto("/bots/new");
  await expect(page.getByLabel(/bot name/i)).toBeVisible();
  await expect(page.getByLabel(/market ids/i)).toBeVisible();
  await page.getByRole("button", { name: /create bot/i }).click();
  await expect(page).toHaveURL(/\/bots\/new/);
});
