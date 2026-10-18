// Instant skeleton for the form builder (shown while the form + themes load,
// e.g. right after creating a form) so the navigation feels immediate.
export default function BuilderLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading builder…">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 rounded bg-probe-100" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-lg bg-probe-100" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_280px] gap-4">
        <div className="card space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-probe-100" />
          ))}
        </div>
        <div className="card space-y-3">
          <div className="h-7 w-1/2 rounded bg-probe-100" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-probe-100" />
          ))}
        </div>
        <div className="card space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-probe-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
