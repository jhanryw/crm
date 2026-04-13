export default function LeadDetailLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <div className="h-3.5 w-12 bg-muted rounded animate-pulse" />
        <div className="h-3.5 w-3 bg-muted rounded animate-pulse" />
        <div className="h-3.5 w-40 bg-muted rounded animate-pulse" />
        <div className="ml-auto h-5 w-20 bg-muted rounded-full animate-pulse" />
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-4 border-b border-border shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-muted rounded-t-lg animate-pulse" />
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-muted/50 rounded-xl h-28 animate-pulse" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 pl-10">
                <div className="w-5 h-5 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 pb-4">
                  <div className="h-3.5 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 border-l border-border bg-card overflow-y-auto shrink-0 p-4 space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-3.5 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-3.5 w-20 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
