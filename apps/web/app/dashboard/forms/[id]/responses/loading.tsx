// Instant skeleton for the responses table while the form + responses load.
export default function ResponsesLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading responses…">
      <div className="h-10 w-80 rounded-[2px] bg-probe-100" />
      <div className="h-8 w-40 rounded-[2px] bg-probe-100" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="h-3 w-1/2 rounded bg-probe-100" />
            <div className="mt-3 h-6 w-1/3 rounded bg-probe-100" />
          </div>
        ))}
      </div>
      <div className="card space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-probe-100" />
        ))}
      </div>
    </div>
  );
}
