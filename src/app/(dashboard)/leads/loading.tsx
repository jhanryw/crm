export default function LeadsLoading() {
  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        <div className="ml-auto flex gap-2">
          <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Contato', 'Temperatura', 'Score', 'Estágio', 'Origem', 'Receita', 'Atualizado'].map(h => (
                <th key={h} className="px-4 py-3 text-left">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 12 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </td>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-3.5 w-16 bg-muted rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
