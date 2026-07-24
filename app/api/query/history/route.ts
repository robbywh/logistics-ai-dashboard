import { NextRequest, NextResponse } from "next/server";
import { getRecentQueryLogs } from "@/lib/query-log";

export async function GET(request: NextRequest) {
  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    const { items, nextCursor } = await getRecentQueryLogs({ cursor, limit });
    return NextResponse.json({ history: items, nextCursor });
  } catch (error) {
    console.error("Failed to load query history:", error);
    return NextResponse.json({ error: "Failed to load query history." }, { status: 500 });
  }
}
