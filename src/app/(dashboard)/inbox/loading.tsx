export default function InboxLoading() {
  return (
    <div className="flex h-full">
      {/* Conversation list skeleton */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          <div className="ml-auto h-5 w-5 bg-muted rounded animate-pulse" />
        </div>
        <div className="p-3 border-b border-border">
          <div className="h-8 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-24 bg-muted rounded animate-pulse" />
                  <div className="ml-auto h-3 w-10 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-3 w-40 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-border">
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 px-4 py-4 space-y-4">
          {[60, 80, 50, 90, 70].map((w, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div
                className="h-10 bg-muted rounded-2xl animate-pulse"
                style={{ width: `${w}%`, maxWidth: 320 }}
              />
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border">
          <div className="h-10 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
