import { prisma } from "./prisma";
import type { OrchestratorResponse } from "./ai/orchestrator";

export type QueryLogEntry = {
  id: string;
  question: string;
  toolUsed: string;
  response: OrchestratorResponse;
  createdAt: string;
};

export type QueryLogPage = {
  items: QueryLogEntry[];
  nextCursor: string | null;
};

/** Fire-and-forget from the route's perspective: a logging failure must
 * never fail the user-facing /api/query response. */
export async function logQuery(
  question: string,
  response: OrchestratorResponse,
): Promise<void> {
  const toolUsed = response.status === "ok" ? response.toolUsed : "clarify";
  await prisma.queryLog.create({
    data: { question, toolUsed, response },
  });
}

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 20;

/**
 * Cursor-based pagination (cursor = a QueryLog id), newest first — backs
 * the "recent questions" infinite scroll in the UI. No cacheStrategy here,
 * unlike getAllOrders(): QueryLog changes on every question, and the UI
 * expects a freshly-submitted question to show up in history right away
 * (see AskClient's post-mutation invalidation).
 */
export async function getRecentQueryLogs(
  options: { cursor?: string; limit?: number } = {},
): Promise<QueryLogPage> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const rows = await prisma.queryLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit + 1, // one extra to know whether a next page exists
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map((row) => ({
      id: row.id,
      question: row.question,
      toolUsed: row.toolUsed,
      response: row.response as unknown as OrchestratorResponse,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
