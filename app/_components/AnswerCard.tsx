type ToolUsed = "queryAnalytics" | "forecastDemand";

const TOOL_LABELS: Record<ToolUsed, string> = {
  queryAnalytics: "Analytics query",
  forecastDemand: "Demand forecast",
};

export function AnswerCard({ answer, toolUsed }: { answer: string; toolUsed: ToolUsed }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="mb-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {TOOL_LABELS[toolUsed]}
      </span>
      <p className="text-base text-zinc-900 dark:text-zinc-50">{answer}</p>
    </div>
  );
}
