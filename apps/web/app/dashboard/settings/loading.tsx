// Instant skeleton for the settings page while account data loads.
export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl animate-pulse" aria-busy="true" aria-label="Loading settings…">
      <div className="h-9 w-40 rounded-lg bg-probe-100" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card space-y-3">
          <div className="h-4 w-1/3 rounded bg-probe-100" />
          <div className="h-10 rounded-lg bg-probe-100" />
          <div className="h-10 w-1/2 rounded-lg bg-probe-100" />
        </div>
      ))}
    </div>
  );
}
