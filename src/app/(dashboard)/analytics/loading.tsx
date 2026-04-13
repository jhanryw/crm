export default function AnalyticsLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
              <div className="h-7 w-20 bg-muted rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Area chart */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          <div className="h-[220px] bg-muted/30 rounded-lg animate-pulse" />
        </div>

        {/* Two charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-[200px] bg-muted/30 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
