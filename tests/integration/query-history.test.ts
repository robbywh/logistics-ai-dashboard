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

describe("GET /api/query/history (integration)", () => {
  it("returns the most recently created QueryLog rows, newest first", async () => {
    await prisma.queryLog.create({
      data: {
        question: `${MARKER} older`,
        toolUsed: "queryAnalytics",
        response: { status: "ok", toolUsed: "queryAnalytics", answer: "older" },
      },
    });
    await prisma.queryLog.create({
      data: {
        question: `${MARKER} newer`,
        toolUsed: "forecastDemand",
        response: { status: "ok", toolUsed: "forecastDemand", answer: "newer" },
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    const marked = body.history.filter((h: { question: string }) => h.question.startsWith(MARKER));
    expect(marked.map((h: { question: string }) => h.question)).toEqual([
      `${MARKER} newer`,
      `${MARKER} older`,
    ]);
  });

  it("reflects a write immediately — no stale cache (regression test for a real bug hit while building this)", async () => {
    const before = await GET().then((r) => r.json());
    expect(before.history.some((h: { question: string }) => h.question === `${MARKER} fresh`)).toBe(
      false,
    );

    await prisma.queryLog.create({
      data: {
        question: `${MARKER} fresh`,
        toolUsed: "queryAnalytics",
        response: { status: "ok", toolUsed: "queryAnalytics", answer: "fresh" },
      },
    });

    const after = await GET().then((r) => r.json());
    expect(after.history.some((h: { question: string }) => h.question === `${MARKER} fresh`)).toBe(
      true,
    );
  });
});
