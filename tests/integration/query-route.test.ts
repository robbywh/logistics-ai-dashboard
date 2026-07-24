import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/query/route";
import { prisma } from "../../lib/prisma";

/**
 * Integration layer for POST /api/query: real route handler, real
 * executeQueryAnalytics/forecastCategory computation, and a real QueryLog
 * write — everything except the external OpenAI network call, which is
 * mocked so this suite is deterministic and free to run in CI. See
 * lib/query-dsl.test.ts / lib/forecast.test.ts for the pure-computation
 * unit tests this builds on.
 *
 * CAUTION: this writes to the real database behind DATABASE_URL (cleaned
 * up in afterEach). Point it at a local/dev database, never at production.
 */
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

const mockedGenerateText = vi.mocked(generateText);
const MARKER = "__integration_test_query_route__";

afterEach(async () => {
  await prisma.queryLog.deleteMany({ where: { question: { startsWith: MARKER } } });
  vi.clearAllMocks();
});

function postRequest(question: string): Request {
  return new Request("http://localhost/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

describe("POST /api/query (integration)", () => {
  it("routes to queryAnalytics, computes a real result, and persists QueryLog", async () => {
    mockedGenerateText
      // routing call: model "picks" queryAnalytics with a count metric
      .mockResolvedValueOnce({
        staticToolCalls: [
          { toolName: "queryAnalytics", input: { metric: "count", groupBy: null, filters: null } },
        ],
        text: "",
      } as never)
      // grounded-answer call
      .mockResolvedValueOnce({ text: "There are 400 orders in total." } as never);

    const question = `${MARKER} how many orders are there`;
    const res = await POST(postRequest(question));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.toolUsed).toBe("queryAnalytics");
    expect(body.chartType).toBe("stat");
    // Real computation over the real (seeded) dataset, not asserted from the mock.
    expect(body.data).toEqual([{ label: "count", value: 400 }]);
    expect(body.answer).toBe("There are 400 orders in total.");

    const logged = await prisma.queryLog.findFirst({ where: { question } });
    expect(logged).not.toBeNull();
    expect(logged?.toolUsed).toBe("queryAnalytics");
  });

  it("routes to forecastDemand and computes a real linear-regression forecast", async () => {
    mockedGenerateText
      .mockResolvedValueOnce({
        staticToolCalls: [
          { toolName: "forecastDemand", input: { category: "CRAYON", horizonMonths: 2, sku: null } },
        ],
        text: "",
      } as never)
      .mockResolvedValueOnce({ text: "Forecast computed." } as never);

    const question = `${MARKER} predict CRAYON demand`;
    const res = await POST(postRequest(question));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.toolUsed).toBe("forecastDemand");
    expect(body.forecast).toHaveLength(2);
    expect(body.methodology).toMatch(/linear regression/i);
  });

  it("returns a clarify response without computing a tool result", async () => {
    mockedGenerateText
      .mockResolvedValueOnce({
        staticToolCalls: [
          { toolName: "clarify", input: { reason: "off-topic", suggestion: null } },
        ],
        text: "",
      } as never)
      .mockResolvedValueOnce({ text: "I can only answer questions about this dataset." } as never);

    const question = `${MARKER} what's the weather today`;
    const res = await POST(postRequest(question));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("clarify");

    const logged = await prisma.queryLog.findFirst({ where: { question } });
    expect(logged?.toolUsed).toBe("clarify");
  });

  it("returns 400 for an empty question without calling the AI", async () => {
    const res = await POST(postRequest(""));
    expect(res.status).toBe(400);
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });
});
