import { NextRequest, NextResponse } from "next/server";
import { computeDashboardSummary } from "@/lib/dashboard";
import { getAllOrders } from "@/lib/orders";

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  const from = parseDateParam(request.nextUrl.searchParams.get("from"));
  const to = parseDateParam(request.nextUrl.searchParams.get("to"));

  try {
    const orders = await getAllOrders();
    const summary = computeDashboardSummary(orders, { from, to });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to compute dashboard summary:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data." },
      { status: 500 },
    );
  }
}
