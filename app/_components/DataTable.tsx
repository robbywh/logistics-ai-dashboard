type Column<T> = {
  key: keyof T;
  label: string;
  format?: (value: T[keyof T]) => React.ReactNode;
};

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  maxHeight = 256,
}: {
  rows: T[];
  columns: Column<T>[];
  maxHeight?: number;
}) {
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-zinc-500 dark:text-zinc-400">
            {columns.map((col) => (
              <th key={String(col.key)} className="py-1 pr-4">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
              {columns.map((col) => (
                <td key={String(col.key)} className="py-1 pr-4">
                  {col.format ? col.format(row[col.key]) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { Column };
