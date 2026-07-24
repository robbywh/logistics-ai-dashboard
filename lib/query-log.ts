import { prisma } from "./prisma";
import type { OrchestratorResponse } from "./ai/orchestrator";

export type QueryLogEntry = {
  id: string;
  question: string;
  toolUsed: string;
  response: OrchestratorResponse;
  createdAt: string;
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

const RECENT_LIMIT = 10;

/** No cacheStrategy here, unlike getAllOrders(): QueryLog changes on every
 * question, and the UI expects a freshly-submitted question to show up in
 * history right away (see AskClient's post-mutation invalidation). */
export async function getRecentQueryLogs(): Promise<QueryLogEntry[]> {
  const rows = await prisma.queryLog.findMany({
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    toolUsed: row.toolUsed,
    response: row.response as unknown as OrchestratorResponse,
    createdAt: row.createdAt.toISOString(),
  }));
}
