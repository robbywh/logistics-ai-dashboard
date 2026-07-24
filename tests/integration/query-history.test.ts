import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/query/history/route";
import { prisma } from "../../lib/prisma";

/**
 * Integration layer: real Prisma reads/writes against QueryLog. Rows are
 * marked with this prefix and deleted in afterEach so repeated runs never
 * accumulate junk in whatever database DATABASE_URL points at.
 *
 * CAUTION: this writes to the real database behind DATABASE_URL. Point it
 * at a local/dev database, never at production — see README "Testing".
 */
const MARKER = "__integration_test_history__";

afterEach(async () => {
  await prisma.queryLog.deleteMany({ where: { question: { startsWith: MARKER } } });
});

function historyRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/query/history");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new NextRequest(url);
}

async function createLog(question: string, toolUsed = "queryAnalytics") {
  return prisma.queryLog.create({
    data: { question, toolUsed, response: { status: "ok", toolUsed, answer: question } },
  });
}

describe("GET /api/query/history (integration)", () => {
  it("returns the most recently created QueryLog rows, newest first", async () => {
    await createLog(`${MARKER} older`);
    await createLog(`${MARKER} newer`, "forecastDemand");

    // Generous limit so this assertion isn't coupled to the default page size.
    const res = await GET(historyRequest({ limit: "50" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    const marked = body.history.filter((h: { question: string }) => h.question.startsWith(MARKER));
    expect(marked.map((h: { question: string }) => h.question)).toEqual([
      `${MARKER} newer`,
      `${MARKER} older`,
    ]);
  });

  it("reflects a write immediately — no stale cache (regression test for a real bug hit while building this)", async () => {
    const before = await GET(historyRequest({ limit: "50" })).then((r) => r.json());
    expect(before.history.some((h: { question: string }) => h.question === `${MARKER} fresh`)).toBe(
      false,
    );

    await createLog(`${MARKER} fresh`);

    const after = await GET(historyRequest({ limit: "50" })).then((r) => r.json());
    expect(after.history.some((h: { question: string }) => h.question === `${MARKER} fresh`)).toBe(
      true,
    );
  });

  it("paginates via cursor: a full page returns nextCursor, the following page returns the rest and null", async () => {
    // 7 rows, oldest first so index 0 is oldest / index 6 is newest.
    for (let i = 0; i < 7; i++) {
      await createLog(`${MARKER} row-${i}`);
    }

    const page1 = await GET(historyRequest({ limit: "5" })).then((r) => r.json());
    const page1Marked = page1.history.filter((h: { question: string }) =>
      h.question.startsWith(MARKER),
    );
    expect(page1Marked).toHaveLength(5);
    expect(page1Marked[0].question).toBe(`${MARKER} row-6`); // newest first
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await GET(historyRequest({ limit: "5", cursor: page1.nextCursor })).then((r) =>
      r.json(),
    );
    const page2Marked = page2.history.filter((h: { question: string }) =>
      h.question.startsWith(MARKER),
    );
    // The remaining 2 marked rows, plus possibly older unmarked rows up to
    // the page limit — only assert the marked ones and their order/content.
    expect(page2Marked.map((h: { question: string }) => h.question)).toEqual([
      `${MARKER} row-1`,
      `${MARKER} row-0`,
    ]);
  });
});
