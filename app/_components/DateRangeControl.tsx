"use client";

import { memo } from "react";

type Props = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
};

export const DateRangeControl = memo(function DateRangeControl({ from, to, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs text-zinc-500 dark:text-zinc-400">
        From
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>
      <label className="flex flex-col text-xs text-zinc-500 dark:text-zinc-400">
        To
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>
    </div>
  );
});
