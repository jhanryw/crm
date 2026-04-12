'use client'

import { useState } from 'react'
import { Lead, PipelineStage } from '@/types'
import { cn, formatCurrency, temperatureLabel, scoreColor } from '@/lib/utils'
import { Flame, Plus, MoreHorizontal, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'

interface PipelineBoardProps {
  initialStages: PipelineStage[]
  initialLeads: Lead[]
}

export function PipelineBoard({ initialStages, initialLeads }: PipelineBoardProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const stageLeads = (stageId: string) =>
    leads.filter(l => l.stage_id === stageId && l.status === 'open')

  const stageValue = (stageId: string) =>
    stageLeads(stageId).reduce((sum, l) => sum + (l.value ?? 0), 0)

  async function handleDrop(stageId: string) {
    if (!draggedId || draggedId === stageId) return

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
        <h1 className="text-base font-semibold">Pipeline</h1>
        <span className="text-xs text-muted-foreground">
          {leads.filter(l => l.status === 'open').length} leads abertos
        </span>
        <span className="text-xs text-emerald-400 font-medium ml-auto">
          {formatCurrency(leads.reduce((s, l) => s + (l.value ?? 0), 0))} em pipeline
        </span>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {initialStages.map(stage => (
            <div
              key={stage.id}
              className={cn(
                'w-72 flex flex-col rounded-xl border transition-colors',
                dragOverStage === stage.id
                  ? 'border-qarvon-500 bg-qarvon-500/5'
                  : 'border-border bg-card/50'
              )}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={() => handleDrop(stage.id)}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-sm font-semibold">{stage.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {stageLeads(stage.id).length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stageValue(stage.id))}
                </p>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
                {stageLeads(stage.id).map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDragStart={() => setDraggedId(lead.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverStage(null) }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LeadCard({
  lead,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-qarvon-500/50 transition-colors group"
    >
      {/* Name & score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">
          {(lead.contact as any)?.name ?? lead.title}
        </p>
        <div className={cn('text-xs font-bold shrink-0', scoreColor(lead.score))}>
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
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground truncate">
            {(lead.assigned_member as any).display_name}
          </p>
        </div>
      )}
    </div>
  )
}
