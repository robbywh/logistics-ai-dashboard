import { UnderlyingDataToggle } from "./UnderlyingDataToggle";

type Props = {
  queryPlan: unknown;
  filtersApplied?: Record<string, string | undefined>;
  metric?: string;
  dimension?: string;
  dateRange?: { from: string; to: string };
  methodology?: string;
  data?: { label: string; value: number }[];
  historical?: { month: string; quantity: number }[];
  forecast?: { month: string; quantity: number; recommendedInventory: number }[];
};

export function ExplainabilityPanel({
  queryPlan,
  filtersApplied,
  metric,
  dimension,
  dateRange,
  methodology,
  data,
  historical,
  forecast,
}: Props) {
  const activeFilters = filtersApplied
    ? Object.entries(filtersApplied).filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        How this was computed
      </h3>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {metric && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Metric</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{metric}</dd>
          </div>
        )}
        {dimension && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Grouped by</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{dimension}</dd>
          </div>
        )}
        {dateRange && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Date range</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">
              {dateRange.from} → {dateRange.to}
            </dd>
          </div>
        )}
        {activeFilters.map(([key, value]) => (
          <div key={key}>
            <dt className="text-zinc-500 capitalize dark:text-zinc-400">{key}</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{value}</dd>
          </div>
        ))}
      </dl>

      {methodology && (
        <p className="mt-3 border-t border-zinc-200 pt-3 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {methodology}
        </p>
      )}

      {data && (
        <UnderlyingDataToggle
          rows={data}
          columns={[
            { key: "label", label: "Label" },
            { key: "value", label: "Value" },
          ]}
        />
      )}

      {historical && (
        <UnderlyingDataToggle
          rows={historical}
          label={`Historical data (${historical.length} months)`}
          columns={[
            { key: "month", label: "Month" },
            { key: "quantity", label: "Quantity" },
          ]}
        />
      )}

      {forecast && (
        <UnderlyingDataToggle
          rows={forecast}
          label={`Forecast data (${forecast.length} months)`}
          columns={[
            { key: "month", label: "Month" },
            { key: "quantity", label: "Forecast qty" },
            { key: "recommendedInventory", label: "Recommended inventory" },
          ]}
        />
      )}

      <details className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-300">
          Raw query plan
        </summary>
        <pre className="mt-2 overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
          {JSON.stringify(queryPlan, null, 2)}
        </pre>
      </details>
    </div>
  );
}
