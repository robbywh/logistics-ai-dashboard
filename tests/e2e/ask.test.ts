import { expect, test } from "@playwright/test";

/**
 * E2E layer for Ask AI. /api/query is mocked at the browser network layer
 * (page.route) rather than called for real: a real call means a real
 * OpenAI request (cost, latency, non-determinism) for every CI run, and
 * whether the model calls the right tool is already covered by
 * tests/integration/query-route.test.ts (which mocks only the AI SDK call
 * and exercises the real computation + persistence). This layer's job is
 * verifying the browser renders a given API response correctly — chart,
 * explainability panel, clarify state, example-question / history
 * shortcuts — not re-verifying AI routing.
 */
test.describe("Ask AI", () => {
  test("asking a question renders the answer and explainability panel", async ({ page }) => {
    await page.route("**/api/query", (route) =>
      route.fulfill({
        json: {
          status: "ok",
          toolUsed: "queryAnalytics",
          answer: "There are 400 orders in total.",
          queryPlan: { metric: "count", groupBy: null, filters: null },
          chartType: "stat",
          metric: "count",
          filtersApplied: {},
          dateRange: { from: "2025-01-01", to: "2025-12-30" },
          data: [{ label: "count", value: 400 }],
        },
      }),
    );
    await page.route("**/api/query/history", (route) => route.fulfill({ json: { history: [] } }));

    await page.goto("/ask");
    await page.getByTestId("ask-question-input").fill("How many orders are there?");
    await page.getByTestId("ask-submit-button").click();

    await expect(page.getByText("There are 400 orders in total.")).toBeVisible();
    await expect(page.getByText("How this was computed")).toBeVisible();
  });

  test("clicking an example question submits it", async ({ page }) => {
    await page.route("**/api/query", async (route) => {
      const { question } = route.request().postDataJSON();
      await route.fulfill({
        json: {
          status: "ok",
          toolUsed: "queryAnalytics",
          answer: `Answered: ${question}`,
          queryPlan: {},
          chartType: "stat",
          metric: "count",
          filtersApplied: {},
          dateRange: { from: "2025-01-01", to: "2025-12-30" },
          data: [{ label: "count", value: 1 }],
        },
      });
    });
    await page.route("**/api/query/history", (route) => route.fulfill({ json: { history: [] } }));

    await page.goto("/ask");
    await page.getByRole("button", { name: "Which carrier has the highest delay rate?" }).click();

    await expect(
      page.getByText("Answered: Which carrier has the highest delay rate?"),
    ).toBeVisible();
  });

  test("shows the clarify message for an off-topic question, not a chart", async ({ page }) => {
    await page.route("**/api/query", (route) =>
      route.fulfill({
        json: {
          status: "clarify",
          answer: "I can only answer questions about the logistics dataset.",
          reason: "off-topic",
        },
      }),
    );
    await page.route("**/api/query/history", (route) => route.fulfill({ json: { history: [] } }));

    await page.goto("/ask");
    await page.getByTestId("ask-question-input").fill("What's the weather today?");
    await page.getByTestId("ask-submit-button").click();

    await expect(
      page.getByText("I can only answer questions about the logistics dataset."),
    ).toBeVisible();
    await expect(page.getByText("How this was computed")).not.toBeVisible();
  });

  test("clicking a recent-questions entry re-submits it for a fresh answer", async ({ page }) => {
    await page.route("**/api/query/history", (route) =>
      route.fulfill({
        json: {
          history: [
            {
              id: "1",
              question: "Which carrier has the highest delay rate?",
              toolUsed: "queryAnalytics",
              response: {},
              createdAt: new Date().toISOString(),
            },
          ],
        },
      }),
    );
    let callCount = 0;
    await page.route("**/api/query", async (route) => {
      callCount += 1;
      await route.fulfill({
        json: {
          status: "ok",
          toolUsed: "queryAnalytics",
          answer: "GLS has the highest delay rate.",
          queryPlan: {},
          chartType: "bar",
          metric: "delayRate",
          filtersApplied: {},
          dateRange: { from: "2025-01-01", to: "2025-12-30" },
          data: [{ label: "GLS", value: 0.375 }],
        },
      });
    });

    await page.goto("/ask");
    await page.getByTestId("history-entry").click();

    await expect(page.getByText("GLS has the highest delay rate.")).toBeVisible();
    // A real POST /api/query was made — this is "ask again," not a replay
    // of stored data (see README "Query history persisted, not computed").
    expect(callCount).toBe(1);
  });

  test("keeps recent questions below the answer, in a bounded scroll region — not blocking the answer as history grows", async ({
    page,
  }) => {
    const manyEntries = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      question: `Historical question number ${i}`,
      toolUsed: "queryAnalytics",
      response: {},
      createdAt: new Date().toISOString(),
    }));
    await page.route("**/api/query/history", (route) =>
      route.fulfill({ json: { history: manyEntries } }),
    );
    await page.route("**/api/query", (route) =>
      route.fulfill({
        json: {
          status: "ok",
          toolUsed: "queryAnalytics",
          answer: "There are 400 orders in total.",
          queryPlan: {},
          chartType: "stat",
          metric: "count",
          filtersApplied: {},
          dateRange: { from: "2025-01-01", to: "2025-12-30" },
          data: [{ label: "count", value: 400 }],
        },
      }),
    );

    await page.goto("/ask");
    await page.getByTestId("ask-question-input").fill("How many orders are there?");
    await page.getByTestId("ask-submit-button").click();
    await expect(page.getByText("There are 400 orders in total.")).toBeVisible();

    // The answer must sit above "Recent questions" in the DOM/visually —
    // a long history list must never push the just-asked answer down.
    const answerBox = await page.getByText("There are 400 orders in total.").boundingBox();
    const historyHeadingBox = await page.getByText("Recent questions").boundingBox();
    expect(answerBox).not.toBeNull();
    expect(historyHeadingBox).not.toBeNull();
    expect(answerBox!.y).toBeLessThan(historyHeadingBox!.y);

    // With 12 entries, the list must scroll internally rather than growing
    // the page — i.e. its own scrollHeight exceeds its own clientHeight.
    const list = page.getByTestId("history-entry").first().locator("xpath=ancestor::ul");
    const isScrollable = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);
  });
});
