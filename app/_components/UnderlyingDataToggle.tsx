import { DataTable, type Column } from "./DataTable";

export function UnderlyingDataToggle<T extends Record<string, unknown>>({
  rows,
  columns,
  label,
}: {
  rows: T[];
  columns: Column<T>[];
  label?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <details className="mt-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-300">
        {label ?? `Underlying data (${rows.length} rows)`}
      </summary>
      <div className="mt-2">
        <DataTable rows={rows} columns={columns} />
      </div>
    </details>
  );
}
