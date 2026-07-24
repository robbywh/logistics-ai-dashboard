import { expect, test } from "@playwright/test";

test.describe("Navigation", () => {
  test("moves between Dashboard and Ask AI via the nav bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.getByRole("link", { name: "Ask AI" }).click();
    await expect(page).toHaveURL(/\/ask$/);
    await expect(page.getByRole("heading", { name: "Ask AI" })).toBeVisible();

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
