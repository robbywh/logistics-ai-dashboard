type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  // Stable hook for E2E assertions (tests/e2e/dashboard.spec.ts) — text
  // content alone isn't a reliable selector since KPI values are numbers
  // that can coincidentally match other numbers on the page.
  const testId = `kpi-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}
