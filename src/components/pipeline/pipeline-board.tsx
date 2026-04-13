'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lead, PipelineStage } from '@/types'
import { cn, formatCurrency, temperatureLabel, scoreColor } from '@/lib/utils'
import { Flame, Users, TrendingUp, Kanban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'

interface PipelineBoardProps {
  initialStages: PipelineStage[]
  initialLeads: Lead[]
}

export function PipelineBoard({ initialStages, initialLeads }: PipelineBoardProps) {
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const openLeads = leads.filter(l => l.status === 'open')
  const stageLeads = (stageId: string) => openLeads.filter(l => l.stage_id === stageId)
  const stageValue = (stageId: string) =>
    stageLeads(stageId).reduce((sum, l) => sum + (l.value ?? 0), 0)
  const totalValue = openLeads.reduce((s, l) => s + (l.value ?? 0), 0)

  async function handleDrop(stageId: string) {
    if (!draggedId) return
    const dragged = leads.find(l => l.id === draggedId)
    if (!dragged || dragged.stage_id === stageId) {
      setDraggedId(null)
      setDragOverStage(null)
      return
    }

    const prevLeads = leads
    setLeads(prev =>
      prev.map(l => l.id === draggedId ? { ...l, stage_id: stageId } : l)
    )

    try {
      const res = await fetch(`/api/leads/${draggedId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: stageId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setLeads(prevLeads)
      toast({ title: 'Erro ao mover lead', variant: 'destructive' })
    }

    setDraggedId(null)
    setDragOverStage(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <Kanban className="w-4 h-4 text-muted-foreground" />
        <h1 className="text-base font-semibold">Pipeline</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {openLeads.length} leads
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            {formatCurrency(totalValue)} em pipeline
          </span>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {initialStages.map(stage => {
            const stageItems = stageLeads(stage.id)
            const isDragOver = dragOverStage === stage.id
            return (
              <div
                key={stage.id}
                className={cn(
                  'w-72 flex flex-col rounded-xl border transition-all duration-150',
                  isDragOver
                    ? 'border-qarvon-500 bg-qarvon-500/5 shadow-lg shadow-qarvon-500/10'
                    : 'border-border bg-card/50'
                )}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStage(null)
                  }
                }}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Column header */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-sm font-semibold truncate">{stage.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
                      {stageItems.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stageItems.length > 0 ? formatCurrency(stageValue(stage.id)) : '—'}
                  </p>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
                  {stageItems.length === 0 ? (
                    <div className={cn(
                      'flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed transition-colors',
                      isDragOver ? 'border-qarvon-500/50 text-qarvon-400' : 'border-border text-muted-foreground'
                    )}>
                      <p className="text-xs">
                        {isDragOver ? 'Soltar aqui' : 'Sem leads'}
                      </p>
                    </div>
                  ) : (
                    stageItems.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        isDragging={draggedId === lead.id}
                        onDragStart={() => setDraggedId(lead.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOverStage(null) }}
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LeadCard({
  lead, isDragging, onDragStart, onDragEnd, onClick,
}: {
  lead: Lead
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
}) {
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart() }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-pointer transition-all',
        'hover:border-qarvon-500/50 hover:shadow-sm hover:shadow-qarvon-500/10',
        isDragging && 'opacity-40 scale-95 rotate-1'
      )}
    >
      {/* Name & score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">
          {(lead.contact as any)?.name ?? lead.title}
        </p>
        <div className={cn('text-xs font-bold shrink-0 tabular-nums', scoreColor(lead.score))}>
          {lead.score}
        </div>
      </div>

      {/* Phone */}
      {(lead.contact as any)?.phone && (
        <p className="text-xs text-muted-foreground mb-2">
          {(lead.contact as any).phone}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={lead.temperature as any} className="text-xs">
          <Flame className="w-2.5 h-2.5 mr-1" />
          {temperatureLabel(lead.temperature)}
        </Badge>
        {lead.value && (
          <span className="text-xs text-emerald-400 font-medium ml-auto">
            {formatCurrency(lead.value)}
          </span>
        )}
      </div>

      {/* Assigned */}
      {(lead.assigned_member as any)?.display_name && (
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
            {((lead.assigned_member as any).display_name as string).charAt(0).toUpperCase()}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {(lead.assigned_member as any).display_name}
          </p>
        </div>
      )}
    </div>
  )
}
