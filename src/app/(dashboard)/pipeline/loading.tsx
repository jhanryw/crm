export default function PipelineLoading() {
  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        <div className="ml-auto h-3 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-72 flex flex-col rounded-xl border border-border bg-card/50">
              <div className="px-4 py-3 border-b border-border space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="ml-auto h-5 w-6 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="p-3 space-y-2">
                {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
                  <div key={j} className="bg-card border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 w-28 bg-muted rounded animate-pulse" />
                      <div className="h-3.5 w-6 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                      <div className="h-5 w-14 bg-muted rounded animate-pulse ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
