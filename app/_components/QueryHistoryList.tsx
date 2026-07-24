"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type HistoryEntry = {
  id: string;
  question: string;
  toolUsed: string;
  response: unknown;
  createdAt: string;
};

type HistoryPage = { history: HistoryEntry[]; nextCursor: string | null };

const TOOL_LABELS: Record<string, string> = {
  queryAnalytics: "Analytics",
  forecastDemand: "Forecast",
  clarify: "Clarify",
};

const PAGE_SIZE = 5;

async function fetchHistoryPage(cursor: string | undefined): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/query/history?${params}`);
  if (!res.ok) throw new Error("Failed to load query history.");
  return res.json();
}

export function QueryHistoryList({
  onSelect,
}: {
  onSelect: (entry: HistoryEntry) => void;
}) {
  // Collapsed by default — nothing is fetched until the user opens this
  // (see `enabled: isOpen` below), so visiting /ask never pays for a
  // history fetch unless the user actually wants to see it.
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const sentinelRef = useRef<HTMLLIElement | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["query-history"],
    queryFn: ({ pageParam }) => fetchHistoryPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isOpen,
  });

  const entries = data?.pages.flatMap((page) => page.history) ?? [];

  // Infinite scroll, scoped to this list's own scroll region (max-h-56
  // overflow-y-auto below) via IntersectionObserver's `root` — not the
  // window, so loading more never grows the page itself.
  useEffect(() => {
    if (!isOpen || !hasNextPage) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { root, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, hasNextPage, isFetchingNextPage, fetchNextPage, entries.length]);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      className="border-t border-zinc-200 pt-3 dark:border-zinc-800"
    >
      <summary className="cursor-pointer text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Recent questions
      </summary>

      <div className="mt-2">
        {isLoading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}
        {!isLoading && entries.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No questions asked yet.</p>
        )}
        {entries.length > 0 && (
          <ul ref={scrollRef} className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  data-testid="history-entry"
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
            {hasNextPage && (
              <li ref={sentinelRef} className="py-1 text-center text-xs text-zinc-400">
                {isFetchingNextPage ? "Loading more…" : ""}
              </li>
            )}
          </ul>
        )}
      </div>
    </details>
  );
}

export type { HistoryEntry };
