import { prisma } from "./prisma";
import type { OrderRecord } from "../prisma/csv";

export type { OrderRecord };

/**
 * Fetches the full order set once. At 400 rows this is cheap enough that
 * every metric (dashboard KPIs, query DSL, forecasting) computes in plain
 * TypeScript over the in-memory array rather than via per-query DB
 * aggregation — keeps the computation layer pure and unit-testable against
 * the same fixture data with no DB connection required. Revisit with
 * DB-side aggregation (Prisma `groupBy`) if the dataset grows significantly.
 */
export async function getAllOrders(): Promise<OrderRecord[]> {
  return prisma.order.findMany();
}
