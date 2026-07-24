import { expect, test } from "@playwright/test";

/**
 * E2E layer: real browser, real Next.js server, real (seeded) database —
 * the dashboard has zero AI dependency (see README "Architecture"), so
 * nothing here is mocked. Figures (400 / 75) match the same fixture
 * asserted independently in lib/dashboard.test.ts (unit) and
 * tests/integration/dashboard-summary.test.ts (integration).
 */
test.describe("Dashboard", () => {
  test("loads KPIs and all three charts from the real database", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("kpi-total-orders")).toContainText("400");
    await expect(page.getByTestId("kpi-delivered")).toContainText("304");
    await expect(page.getByTestId("kpi-delayed")).toContainText("66");

    await expect(page.getByText("Order volume over time")).toBeVisible();
    await expect(page.getByText("Delivery performance")).toBeVisible();
    await expect(page.getByText("Carrier delay rate")).toBeVisible();
  });

  test("changing the date range re-fetches and updates the KPIs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("kpi-total-orders")).toContainText("400");

    // exact: true — "To" would otherwise substring-match the Next.js dev
    // tools button's aria-label ("Open Next.js Dev Tools" contains "Tools").
    await page.getByLabel("From", { exact: true }).fill("2025-01-01");
    await page.getByLabel("To", { exact: true }).fill("2025-01-31");

    await expect(page.getByTestId("kpi-total-orders")).toContainText("75");
  });
});
