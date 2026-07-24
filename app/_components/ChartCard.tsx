export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </h2>
      {children}
    </div>
  );
}
