import { expect, test } from "@playwright/test";

test("login page is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /polyagent/i })).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test("login succeeds when dashboard password is unset", async ({ page }) => {
  const response = await page.request.post("/api/auth/login", {
    data: { password: "anything" },
  });
  expect(response.ok()).toBeTruthy();
});
