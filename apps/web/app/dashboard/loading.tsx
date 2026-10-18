// Shown instantly during dashboard navigations (e.g. right after login) while
// the segment's data loads — so the page never feels frozen.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading…">
      <div className="h-8 w-56 rounded-[2px] bg-probe-100" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="h-4 w-2/3 rounded bg-probe-100" />
            <div className="mt-3 h-3 w-1/2 rounded bg-probe-100" />
            <div className="mt-6 h-3 w-1/3 rounded bg-probe-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
