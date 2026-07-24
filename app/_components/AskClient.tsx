"use client";

import { useState } from "react";
import { AnswerCard } from "./AnswerCard";
import { ExplainabilityPanel } from "./ExplainabilityPanel";
import { ForecastChart } from "./ForecastChart";
import { QueryResultChart } from "./QueryResultChart";

type QueryAnalyticsResponse = {
  status: "ok";
  toolUsed: "queryAnalytics";
  answer: string;
  queryPlan: unknown;
  chartType: "line" | "bar" | "stat";
  metric: string;
  dimension?: string;
  filtersApplied: Record<string, string | undefined>;
  dateRange: { from: string; to: string };
  data: { label: string; value: number }[];
};

type ForecastDemandResponse = {
  status: "ok";
  toolUsed: "forecastDemand";
  answer: string;
  queryPlan: unknown;
  chartType: "line";
  methodology: string;
  historical: { month: string; quantity: number }[];
  forecast: { month: string; quantity: number; recommendedInventory: number }[];
};

type ClarifyResponse = {
  status: "clarify";
  answer: string;
  reason: string;
  suggestion?: string;
};

type QueryApiResponse = QueryAnalyticsResponse | ForecastDemandResponse | ClarifyResponse;

const EXAMPLE_QUESTIONS = [
  "Show delayed orders by week for the last 3 months",
  "Which carrier has the highest delay rate?",
  "How many orders were delivered late last month?",
  "Predict demand for CRAYON for the next 4 months",
];

export function AskClient() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<QueryApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      setResponse(data as QueryApiResponse);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ask AI</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Ask a question about the logistics dataset — orders, delivery performance,
          carriers, or demand forecasts.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which carrier has the highest delay rate?"
          className="flex-1 rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setQuestion(q);
              submit(q);
            }}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {response && response.status === "clarify" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {response.answer}
        </div>
      )}

      {response && response.status === "ok" && response.toolUsed === "queryAnalytics" && (
        <div className="flex flex-col gap-4">
          <AnswerCard answer={response.answer} toolUsed="queryAnalytics" />
          <QueryResultChart
            chartType={response.chartType}
            data={response.data}
            metric={response.metric}
          />
          <ExplainabilityPanel
            queryPlan={response.queryPlan}
            filtersApplied={response.filtersApplied}
            metric={response.metric}
            dimension={response.dimension}
            dateRange={response.dateRange}
            data={response.data}
          />
        </div>
      )}

      {response && response.status === "ok" && response.toolUsed === "forecastDemand" && (
        <div className="flex flex-col gap-4">
          <AnswerCard answer={response.answer} toolUsed="forecastDemand" />
          <ForecastChart historical={response.historical} forecast={response.forecast} />
          <ExplainabilityPanel
            queryPlan={response.queryPlan}
            methodology={response.methodology}
            historical={response.historical}
            forecast={response.forecast}
          />
        </div>
      )}
    </div>
  );
}
