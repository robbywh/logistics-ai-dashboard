import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { type ForecastDemandInput, type ForecastResult, forecastCategory } from "../forecast";
import { getAllOrders } from "../orders";
import { executeQueryAnalytics, type QueryAnalyticsInput, type QueryResult } from "../query-dsl";
import { orchestratorTools } from "./tools";

const ROUTING_SYSTEM_PROMPT = `
You are the analytics assistant for a logistics dashboard. You must ALWAYS call exactly one tool to answer — never answer from your own knowledge, and never guess a number.

Available tools:
- queryAnalytics: counts, delay rates, average delivery time, optionally broken down by time/carrier/region/category/status.
- forecastDemand: future demand forecast + inventory recommendation for a product category.
- clarify: use when the question is off-topic, too ambiguous, or outside this dataset's scope.

Rules:
- For RELATIVE date phrases ("last month", "last 3 months", "this year"), use the relativeDateRange enum on queryAnalytics — never compute actual calendar dates yourself.
- For explicit calendar dates/months/years the user names directly, use dateFrom/dateTo on queryAnalytics.
- Only set a filter field (status, carrier, region, category, dateFrom, dateTo, relativeDateRange) if the user's question EXPLICITLY names that specific value. Never guess, never fill a field with an example value, never pass an empty string. Most questions should leave most filter fields unset — an unfiltered or lightly-filtered query is normal and correct.
`.trim();

const ANSWER_SYSTEM_PROMPT = `
Restate ONLY the numbers/values present in the provided tool result, in one or two short, plain-language sentences. Never introduce a number that isn't in the result. If the tool was "clarify", politely explain why the question couldn't be answered and offer the suggested rephrasing if one is present. If the tool was "forecastDemand" and its input includes a "sku", explicitly note that the forecast is computed at the product-category level (not per-SKU), since individual SKUs in this dataset have too little order history to fit a trend.
`.trim();

export type OrchestratorResponse =
  | {
      status: "ok";
      toolUsed: "queryAnalytics";
      answer: string;
      queryPlan: QueryAnalyticsInput;
      chartType: QueryResult["chartType"];
      metric: string;
      dimension?: string;
      filtersApplied: QueryResult["filtersApplied"];
      dateRange: QueryResult["dateRange"];
      data: QueryResult["data"];
    }
  | {
      status: "ok";
      toolUsed: "forecastDemand";
      answer: string;
      queryPlan: ForecastDemandInput;
      chartType: "line";
      methodology: string;
      historical: ForecastResult["historical"];
      forecast: ForecastResult["forecast"];
    }
  | {
      status: "clarify";
      answer: string;
      reason: string;
      suggestion?: string;
    };

function model() {
  return openai(process.env.OPENAI_MODEL || "gpt-4o-mini");
}

async function generateGroundedAnswer(
  question: string,
  toolName: string,
  input: unknown,
  result: unknown,
): Promise<string> {
  const { text } = await generateText({
    model: model(),
    system: ANSWER_SYSTEM_PROMPT,
    prompt: [
      `User question: ${question}`,
      `Tool called: ${toolName}`,
      `Tool input: ${JSON.stringify(input)}`,
      `Tool result: ${JSON.stringify(result)}`,
      "Write the final answer.",
    ].join("\n"),
  });
  return text.trim();
}

export async function answerQuestion(question: string): Promise<OrchestratorResponse> {
  const routing = await generateText({
    model: model(),
    system: ROUTING_SYSTEM_PROMPT,
    prompt: question,
    tools: orchestratorTools,
    toolChoice: "required",
  });

  const call = routing.staticToolCalls[0];
  if (!call) {
    return {
      status: "clarify",
      answer:
        routing.text.trim() || "I couldn't understand that question. Could you rephrase it?",
      reason: "The assistant did not select a tool for this question.",
    };
  }

  if (call.toolName === "clarify") {
    const input = call.input;
    const answer = await generateGroundedAnswer(question, "clarify", input, input);
    return {
      status: "clarify",
      answer,
      reason: input.reason,
      suggestion: input.suggestion ?? undefined,
    };
  }

  if (call.toolName === "queryAnalytics") {
    const input = call.input;
    const orders = await getAllOrders();
    const result = executeQueryAnalytics(orders, input);
    const answer = await generateGroundedAnswer(question, "queryAnalytics", input, result);
    return {
      status: "ok",
      toolUsed: "queryAnalytics",
      answer,
      queryPlan: input,
      chartType: result.chartType,
      metric: result.metric,
      dimension: result.dimension,
      filtersApplied: result.filtersApplied,
      dateRange: result.dateRange,
      data: result.data,
    };
  }

  const input = call.input;
  const orders = await getAllOrders();
  const result = forecastCategory(orders, input);
  const answer = await generateGroundedAnswer(question, "forecastDemand", input, result);
  return {
    status: "ok",
    toolUsed: "forecastDemand",
    answer,
    queryPlan: input,
    chartType: "line",
    methodology: result.methodology,
    historical: result.historical,
    forecast: result.forecast,
  };
}
