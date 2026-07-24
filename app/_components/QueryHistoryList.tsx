"use client";

import { useQuery } from "@tanstack/react-query";

type HistoryEntry = {
  id: string;
  question: string;
  toolUsed: string;
  response: unknown;
  createdAt: string;
};

const TOOL_LABELS: Record<string, string> = {
  queryAnalytics: "Analytics",
  forecastDemand: "Forecast",
  clarify: "Clarify",
};

async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch("/api/query/history");
  if (!res.ok) throw new Error("Failed to load query history.");
  const data = await res.json();
  return data.history;
}

export function QueryHistoryList({
  onSelect,
}: {
  onSelect: (entry: HistoryEntry) => void;
}) {
  const { data: history } = useQuery({
    queryKey: ["query-history"],
    queryFn: fetchHistory,
  });

  if (!history || history.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Recent questions
      </h2>
      <ul className="flex flex-col gap-1">
        {history.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {TOOL_LABELS[entry.toolUsed] ?? entry.toolUsed}
              </span>
              <span className="truncate">{entry.question}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { HistoryEntry };
