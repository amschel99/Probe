// Instant skeleton for the analytics dashboard while metrics load.
export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading analytics…">
      <div className="h-10 w-80 rounded-xl bg-probe-100" />
      <div className="h-8 w-40 rounded-lg bg-probe-100" />
      <div className="grid sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="h-3 w-1/2 rounded bg-probe-100" />
            <div className="mt-3 h-7 w-1/3 rounded bg-probe-100" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="h-6 w-1/3 rounded bg-probe-100" />
        <div className="mt-4 h-56 rounded-xl bg-probe-100" />
      </div>
    </div>
  );
}
