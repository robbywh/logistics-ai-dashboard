import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/orchestrator";

export async function POST(request: Request) {
  let question = "";
  try {
    const body = await request.json();
    if (typeof body?.question === "string") {
      question = body.question.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  try {
    const response = await answerQuestion(question);
    return NextResponse.json(response);
  } catch (error) {
    console.error("AI orchestration failed:", error);
    return NextResponse.json(
      { error: "The AI assistant is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
