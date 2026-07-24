type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}
