'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lead } from '@/types'
import { formatCurrency, formatRelative, temperatureLabel, scoreColor, cn, formatPhone } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Flame, Star, Search } from 'lucide-react'

interface LeadsTableProps {
  initialLeads: Lead[]
}

export function LeadsTable({ initialLeads }: LeadsTableProps) {
  const router = useRouter()
  const [leads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'hot' | 'burning' | 'warm'>('all')

  const filtered = leads.filter(l => {
    const name = (l.contact as any)?.name ?? ''
    const phone = (l.contact as any)?.phone ?? ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search)
    const matchFilter = filter === 'all' || l.temperature === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold">Leads</h1>
        <div className="ml-auto flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lead..."
              className="bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-qarvon-600 w-56"
            />
          </div>

          {/* Filter */}
          {(['all', 'burning', 'hot', 'warm'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                filter === t
                  ? 'bg-qarvon-600/20 border-qarvon-500 text-qarvon-400'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'all' ? 'Todos' : temperatureLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Lead</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Temperatura</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estágio</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Origem</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(lead => (
              <tr
                key={lead.id}
                onClick={() => router.push(`/leads/${lead.id}`)}
                className="hover:bg-accent transition-colors cursor-pointer"
              >
                <td className="px-6 py-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {(lead.contact as any)?.name ?? lead.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPhone((lead.contact as any)?.phone)}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={lead.temperature as any}>
                    <Flame className="w-2.5 h-2.5 mr-1" />
                    {temperatureLabel(lead.temperature)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Star className={cn('w-3.5 h-3.5', scoreColor(lead.score))} />
                    <span className={cn('font-bold', scoreColor(lead.score))}>{lead.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(lead.stage as any) ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${(lead.stage as any).color}20`,
                        color: (lead.stage as any).color,
                      }}
                    >
                      {(lead.stage as any).name}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-muted-foreground">
                    <p>{lead.source ?? '—'}</p>
                    {(lead.campaign as any)?.name && (
                      <p className="truncate max-w-[120px]">{(lead.campaign as any).name}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-emerald-400 font-semibold">
                      {formatCurrency((lead.contact as any)?.total_revenue ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(lead.contact as any)?.purchase_count ?? 0} compras
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatRelative(lead.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhum lead encontrado
          </div>
        )}
      </div>
    </div>
  )
}
