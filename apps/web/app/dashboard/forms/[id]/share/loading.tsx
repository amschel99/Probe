// Instant skeleton for the share page while the form loads.
export default function ShareLoading() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse" aria-busy="true" aria-label="Loading share…">
      <div className="h-10 w-80 rounded-[2px] bg-probe-100" />
      <div className="h-8 w-32 rounded-[2px] bg-probe-100" />
      <div className="card">
        <div className="h-3 w-24 rounded bg-probe-100" />
        <div className="mt-3 h-10 rounded-[2px] bg-probe-100" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card h-64 rounded-[2px] bg-probe-50" />
        <div className="card h-64 rounded-[2px] bg-probe-50" />
      </div>
    </div>
  );
}
