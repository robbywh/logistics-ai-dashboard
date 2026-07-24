import { NextResponse } from "next/server";
import { getRecentQueryLogs } from "@/lib/query-log";

export async function GET() {
  try {
    const history = await getRecentQueryLogs();
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Failed to load query history:", error);
    return NextResponse.json({ error: "Failed to load query history." }, { status: 500 });
  }
}
