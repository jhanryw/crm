'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, ShoppingBag, Flame, Star, Target,
  Clock, MessageSquare, Instagram, User, Tag, Plus, Check,
  Zap, TrendingUp, Send, Edit2, X, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  cn, formatCurrency, formatDate, formatRelative, formatPhone,
  temperatureLabel, scoreColor,
} from '@/lib/utils'

// ─── Local types ─────────────────────────────────────────────

interface Contact {
  id: string; name: string | null; phone: string | null; email: string | null
  total_revenue: number; purchase_count: number; last_purchase_at: string | null
  tags: string[]; avatar_url: string | null
}
interface Stage { id: string; name: string; color: string; position: number; is_won: boolean; is_lost: boolean }
interface Member { id: string; display_name: string | null; avatar_url: string | null; role: string }
interface Campaign { id: string; name: string; platform: string; utm_campaign: string | null }
interface Creative { id: string; name: string; utm_content: string | null }

interface Lead {
  id: string; workspace_id: string; contact_id: string; title: string
  stage_id: string | null; assigned_to: string | null
  value: number | null; currency: string; score: number; temperature: string
  next_action: string | null; next_action_at: string | null
  source: string | null; medium: string | null
  ctwa_clid: string | null; fbclid: string | null; gclid: string | null
  status: string; won_at: string | null; lost_at: string | null; notes: string | null
  created_at: string; updated_at: string
  contact: Contact; stage: Stage | null; assigned_member: Member | null
  campaign: Campaign | null; creative: Creative | null
}

interface Activity {
  id: string; type: string; title: string; body: string | null
  metadata: Record<string, unknown>; created_at: string
  actor: Member | null
}

interface Note {
  id: string; content: string; created_at: string
  author: Member | null
}

interface Task {
  id: string; title: string; description: string | null; priority: string
  due_at: string | null; completed_at: string | null
  assigned_member: { id: string; display_name: string | null } | null
}

interface Conversation {
  id: string; channel_id: string; status: string; created_at: string
  channel: { id: string; type: string; name: string } | null
}

interface Message {
  id: string; conversation_id: string; direction: string; sender_type: string
  type: string; content: string | null; media_url: string | null; status: string
  created_at: string; sender_agent: Member | null
}

interface TouchEvent {
  id: string; event_type: string; event_at: string
  campaign: { name: string; platform: string } | null
  creative: { name: string } | null
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  ctwa_clid: string | null; fbclid: string | null; gclid: string | null
}

interface SaleEvent {
  id: string; event_type: string; payload: Record<string, unknown>
  processed: boolean; created_at: string
}

interface CapiEvent {
  id: string; platform: string; event_name: string; status: string
  attempts: number; created_at: string; sent_at: string | null
}

interface LeadDetailProps {
  lead: Lead
  stages: Stage[]
  members: Member[]
  activities: Activity[]
  notes: Note[]
  tasks: Task[]
  conversations: Conversation[]
  messages: Message[]
  touchEvents: TouchEvent[]
  saleEvents: SaleEvent[]
  capiEvents: CapiEvent[]
}

type Tab = 'timeline' | 'messages' | 'attribution' | 'sales' | 'capi'

// ─── Component ───────────────────────────────────────────────

export function LeadDetail({
  lead: initialLead, stages, members, activities, notes, tasks: initialTasks,
  conversations, messages, touchEvents, saleEvents, capiEvents,
}: LeadDetailProps) {
  const router = useRouter()
  const [lead, setLead] = useState(initialLead)
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTab, setActiveTab] = useState<Tab>('timeline')
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  async function patchLead(update: Record<string, unknown>) {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
    const updated = await res.json()
    setLead(prev => ({ ...prev, ...updated }))
    router.refresh()
  }

  async function handleSaveNote() {
    if (!noteInput.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteInput }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Nota salva' })
      setNoteInput('')
      router.refresh()
    } catch {
      toast({ title: 'Erro ao salvar nota', variant: 'destructive' })
    } finally {
      setSavingNote(false)
    }
  }

  async function handleCreateTask(data: { title: string; priority: string; due_at: string | null }) {
    const res = await fetch(`/api/leads/${lead.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast({ title: 'Erro ao criar tarefa', variant: 'destructive' })
      return
    }
    const task = await res.json()
    setTasks(prev => [...prev, task])
    toast({ title: 'Tarefa criada' })
  }

  async function handleCompleteTask(taskId: string, completed: boolean) {
    const res = await fetch(`/api/leads/${lead.id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    if (!res.ok) return
    const updated = await res.json()
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'timeline', label: 'Timeline', count: activities.length + notes.length },
    { id: 'messages', label: 'Mensagens', count: messages.length },
    { id: 'attribution', label: 'Atribuição', count: touchEvents.length },
    { id: 'sales', label: 'Vendas', count: saleEvents.length },
    { id: 'capi', label: 'CAPI', count: capiEvents.length },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <Link
          href="/leads"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Leads
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold text-foreground">
          {lead.contact?.name ?? lead.title}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant={lead.temperature as 'hot' | 'warm' | 'cold' | 'burning'}>
            <Flame className="w-2.5 h-2.5 mr-1" />
            {temperatureLabel(lead.temperature)}
          </Badge>
          {lead.status === 'won' && <Badge variant="success">Ganho</Badge>}
          {lead.status === 'lost' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
              Perdido
            </span>
          )}
          {lead.status === 'open' && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 text-xs"
                onClick={async () => {
                  try {
                    await patchLead({ status: 'won' })
                    toast({ title: 'Lead marcado como Ganho' })
                  } catch {
                    toast({ title: 'Erro ao atualizar', variant: 'destructive' })
                  }
                }}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Marcar Ganho
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 text-xs"
                onClick={async () => {
                  try {
                    await patchLead({ status: 'lost' })
                    toast({ title: 'Lead marcado como Perdido' })
                  } catch {
                    toast({ title: 'Erro ao atualizar', variant: 'destructive' })
                  }
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Perdido
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Body: two columns */}
      <div className="flex-1 overflow-hidden flex">

        {/* Left: tabs + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-6 pt-4 border-b border-border shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === tab.id
                    ? 'border-qarvon-500 text-qarvon-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'text-xs rounded-full px-1.5 py-0.5',
                    activeTab === tab.id ? 'bg-qarvon-600/20 text-qarvon-400' : 'bg-muted'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'timeline' && (
              <TimelineTab
                activities={activities}
                notes={notes}
                noteInput={noteInput}
                setNoteInput={setNoteInput}
                savingNote={savingNote}
                onSaveNote={handleSaveNote}
              />
            )}
            {activeTab === 'messages' && (
              <MessagesTab messages={messages} conversations={conversations} />
            )}
            {activeTab === 'attribution' && (
              <AttributionTab touchEvents={touchEvents} lead={lead} />
            )}
            {activeTab === 'sales' && (
              <SalesTab saleEvents={saleEvents} />
            )}
            {activeTab === 'capi' && (
              <CapiTab capiEvents={capiEvents} />
            )}
          </div>
        </div>

        {/* Right: intelligence sidebar */}
        <div className="w-72 border-l border-border bg-card overflow-y-auto shrink-0">
          <LeadSidebar
            lead={lead}
            stages={stages}
            members={members}
            tasks={tasks}
            onPatchLead={patchLead}
            onCreateTask={handleCreateTask}
            onCompleteTask={handleCompleteTask}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────

function TimelineTab({
  activities, notes, noteInput, setNoteInput, savingNote, onSaveNote,
}: {
  activities: Activity[]
  notes: Note[]
  noteInput: string
  setNoteInput: (v: string) => void
  savingNote: boolean
  onSaveNote: () => void
}) {
  type TimelineItem =
    | { kind: 'activity'; data: Activity; date: string }
    | { kind: 'note'; data: Note; date: string }

  const items: TimelineItem[] = [
    ...activities.map(a => ({ kind: 'activity' as const, data: a, date: a.created_at })),
    ...notes.map(n => ({ kind: 'note' as const, data: n, date: n.created_at })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Adicionar nota
        </p>
        <textarea
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          placeholder="Escreva uma nota sobre este lead..."
          rows={3}
          className="w-full resize-none bg-background rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-qarvon-600"
        />
        <div className="flex justify-end">
          <Button
            variant="brand"
            size="sm"
            onClick={onSaveNote}
            disabled={savingNote || !noteInput.trim()}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Salvar nota
          </Button>
        </div>
      </div>

      {items.length === 0 && <EmptyState icon={Clock} text="Nenhuma atividade ainda" />}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="relative flex gap-4 pl-10">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full border-2 border-border bg-card flex items-center justify-center shrink-0">
                {item.kind === 'note'
                  ? <MessageSquare className="w-2.5 h-2.5 text-qarvon-400" />
                  : <ActivityIcon type={item.data.type} />
                }
              </div>
              <div className="flex-1 min-w-0 pb-4">
                {item.kind === 'activity'
                  ? <ActivityItem activity={item.data} />
                  : <NoteItem note={item.data} />
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    stage_change: <Target className="w-2.5 h-2.5 text-blue-400" />,
    purchase: <ShoppingBag className="w-2.5 h-2.5 text-emerald-400" />,
    score_update: <Star className="w-2.5 h-2.5 text-yellow-400" />,
    assignment: <User className="w-2.5 h-2.5 text-purple-400" />,
    message: <MessageSquare className="w-2.5 h-2.5 text-muted-foreground" />,
    note: <MessageSquare className="w-2.5 h-2.5 text-qarvon-400" />,
  }
  return <>{icons[type] ?? <Clock className="w-2.5 h-2.5 text-muted-foreground" />}</>
}

function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm text-foreground">{activity.title}</p>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {formatRelative(activity.created_at)}
        </span>
      </div>
      {activity.body && <p className="text-xs text-muted-foreground mt-0.5">{activity.body}</p>}
      {activity.actor && (
        <p className="text-xs text-muted-foreground mt-0.5">por {activity.actor.display_name}</p>
      )}
    </div>
  )
}

function NoteItem({ note }: { note: Note }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
      <p className="text-xs text-muted-foreground mt-2">
        {note.author?.display_name ?? 'Sistema'} · {formatDate(note.created_at)}
      </p>
    </div>
  )
}

// ─── Messages Tab ─────────────────────────────────────────────

function MessagesTab({ messages, conversations }: { messages: Message[]; conversations: Conversation[] }) {
  if (messages.length === 0) return <EmptyState icon={MessageSquare} text="Nenhuma mensagem" />

  const convMap = new Map(conversations.map(c => [c.id, c]))

  return (
    <div className="space-y-3">
      {messages.map(msg => {
        const conv = convMap.get(msg.conversation_id)
        const isOut = msg.direction === 'outbound'
        return (
          <div key={msg.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-sm', isOut ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
              {conv?.channel && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {conv.channel.type === 'whatsapp'
                    ? <MessageSquare className="w-3 h-3 text-emerald-400" />
                    : <Instagram className="w-3 h-3 text-pink-400" />
                  }
                  {conv.channel.name}
                </span>
              )}
              <div className={cn(
                'px-4 py-2.5 rounded-2xl text-sm',
                isOut ? 'bg-qarvon-600 text-white rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'
              )}>
                {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}
                {msg.type === 'image' && msg.media_url && (
                  <img src={msg.media_url} alt="" className="rounded-lg max-w-full" />
                )}
                {!['text', 'image'].includes(msg.type) && (
                  <span className="italic text-xs opacity-70">[{msg.type}]</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(msg.created_at)}</span>
                {isOut && <MessageStatusDot status={msg.status} />}
                {isOut && msg.sender_agent && <span>· {msg.sender_agent.display_name}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MessageStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'text-muted-foreground',
    sent: 'text-muted-foreground',
    delivered: 'text-blue-400',
    read: 'text-qarvon-400',
    failed: 'text-destructive',
  }
  const labels: Record<string, string> = {
    queued: '○', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '✗',
  }
  return (
    <span className={cn('font-medium text-xs', map[status] ?? 'text-muted-foreground')}>
      {labels[status] ?? ''}
    </span>
  )
}

// ─── Attribution Tab ──────────────────────────────────────────

function AttributionTab({ touchEvents, lead }: { touchEvents: TouchEvent[]; lead: Lead }) {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Atribuição do Lead
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {lead.source && <AttrRow label="Canal" value={lead.source} />}
          {lead.medium && <AttrRow label="Meio" value={lead.medium} />}
          {lead.campaign?.name && <AttrRow label="Campanha" value={lead.campaign.name} className="col-span-2" />}
          {lead.creative?.name && <AttrRow label="Criativo" value={lead.creative.name} className="col-span-2" />}
          {lead.ctwa_clid && <AttrRow label="ctwa_clid" value="✓ Presente" highlight />}
          {lead.fbclid && <AttrRow label="fbclid" value="✓ Presente" highlight />}
          {lead.gclid && <AttrRow label="gclid" value="✓ Presente" highlight />}
        </div>
      </div>

      {touchEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Touchpoints ({touchEvents.length})
          </h3>
          <div className="space-y-2">
            {touchEvents.map(te => (
              <div key={te.id} className="bg-card border border-border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium capitalize">{te.event_type}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(te.event_at)}</span>
                </div>
                {te.campaign && (
                  <p className="text-xs text-muted-foreground">{te.campaign.platform} · {te.campaign.name}</p>
                )}
                {te.creative && <p className="text-xs text-muted-foreground">{te.creative.name}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {te.ctwa_clid && <span className="text-xs bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded">ctwa</span>}
                  {te.fbclid && <span className="text-xs bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded">fb</span>}
                  {te.gclid && <span className="text-xs bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded">gads</span>}
                  {te.utm_campaign && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{te.utm_campaign}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {touchEvents.length === 0 && !lead.ctwa_clid && !lead.fbclid && !lead.gclid && (
        <EmptyState icon={TrendingUp} text="Sem dados de atribuição" />
      )}
    </div>
  )
}

function AttrRow({ label, value, highlight, className }: {
  label: string; value: string; highlight?: boolean; className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium truncate', highlight ? 'text-emerald-400' : 'text-foreground')}>
        {value}
      </span>
    </div>
  )
}

// ─── Sales Tab ────────────────────────────────────────────────

function SalesTab({ saleEvents }: { saleEvents: SaleEvent[] }) {
  if (saleEvents.length === 0) return <EmptyState icon={ShoppingBag} text="Nenhuma venda registrada" />

  return (
    <div className="space-y-3">
      {saleEvents.map(ev => {
        const p = ev.payload
        return (
          <div key={ev.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold capitalize">
                  {String(ev.event_type).replace('.', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {ev.processed
                  ? <Badge variant="success" className="text-xs">Processado</Badge>
                  : <span className="text-xs text-muted-foreground">Pendente</span>
                }
                <span className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</span>
              </div>
            </div>
            {p && typeof p === 'object' && (
              <div className="text-sm space-y-1">
                {(p as Record<string, unknown>).total !== undefined && (
                  <p className="text-emerald-400 font-bold text-lg">
                    {formatCurrency(Number((p as Record<string, unknown>).total))}
                  </p>
                )}
                {Boolean((p as Record<string, unknown>).sale_id) && (
                  <p className="text-xs text-muted-foreground">
                    Pedido #{String((p as Record<string, unknown>).sale_id)}
                  </p>
                )}
                {Array.isArray((p as Record<string, unknown>).items) && (
                  <div className="mt-2 space-y-1">
                    {((p as Record<string, unknown>).items as Record<string, unknown>[]).map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {String(item.quantity)}x {String(item.product_name)} — {formatCurrency(Number(item.total))}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── CAPI Tab ─────────────────────────────────────────────────

const capiStatusColor: Record<string, string> = {
  sent: 'text-emerald-400',
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  failed: 'text-destructive',
  skipped: 'text-muted-foreground',
}

function CapiTab({ capiEvents }: { capiEvents: CapiEvent[] }) {
  if (capiEvents.length === 0) return <EmptyState icon={Zap} text="Nenhum evento CAPI" />

  return (
    <div className="space-y-2">
      {capiEvents.map(ev => (
        <div key={ev.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{ev.event_name}</span>
              <span className="text-xs text-muted-foreground capitalize">{ev.platform}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ev.attempts} tentativa{ev.attempts !== 1 ? 's' : ''} · {formatDate(ev.created_at)}
            </p>
          </div>
          <span className={cn('text-xs font-semibold capitalize', capiStatusColor[ev.status] ?? 'text-muted-foreground')}>
            {ev.status}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Lead Sidebar (editable) ──────────────────────────────────

function LeadSidebar({
  lead, stages, members, tasks, onPatchLead, onCreateTask, onCompleteTask,
}: {
  lead: Lead
  stages: Stage[]
  members: Member[]
  tasks: Task[]
  onPatchLead: (update: Record<string, unknown>) => Promise<void>
  onCreateTask: (data: { title: string; priority: string; due_at: string | null }) => Promise<void>
  onCompleteTask: (id: string, completed: boolean) => Promise<void>
}) {
  const pendingTasks = tasks.filter(t => !t.completed_at)
  const [editingNextAction, setEditingNextAction] = useState(false)
  const [nextActionDraft, setNextActionDraft] = useState(lead.next_action ?? '')
  const [editingValue, setEditingValue] = useState(false)
  const [valueDraft, setValueDraft] = useState(String(lead.value ?? ''))
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskPriority, setTaskPriority] = useState('normal')
  const [savingNextAction, setSavingNextAction] = useState(false)
  const [savingValue, setSavingValue] = useState(false)

  async function saveNextAction() {
    setSavingNextAction(true)
    try {
      await onPatchLead({ next_action: nextActionDraft || null })
      setEditingNextAction(false)
      toast({ title: 'Próxima ação salva' })
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSavingNextAction(false)
    }
  }

  async function saveValue() {
    const num = parseFloat(valueDraft.replace(',', '.'))
    if (isNaN(num) && valueDraft !== '') {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    setSavingValue(true)
    try {
      await onPatchLead({ value: valueDraft === '' ? null : num })
      setEditingValue(false)
      toast({ title: 'Valor atualizado' })
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSavingValue(false)
    }
  }

  async function submitTaskForm() {
    if (!taskTitle.trim()) return
    await onCreateTask({
      title: taskTitle.trim(),
      priority: taskPriority,
      due_at: taskDue || null,
    })
    setTaskTitle('')
    setTaskDue('')
    setTaskPriority('normal')
    setShowTaskForm(false)
  }

  return (
    <div className="p-4 space-y-6">
      {/* Score + Temperature */}
      <div>
        <SectionTitle>Lead Intelligence</SectionTitle>
        <div className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="w-3.5 h-3.5" /> Score
            </div>
            <span className={cn('text-sm font-bold', scoreColor(lead.score))}>
              {lead.score}/100
            </span>
          </div>

          <div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${lead.score}%`,
                  backgroundColor: lead.score >= 70 ? '#f97316' : lead.score >= 40 ? '#eab308' : '#6b7280',
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flame className="w-3.5 h-3.5" /> Temperatura
            </div>
            <Badge variant={lead.temperature as 'hot' | 'warm' | 'cold' | 'burning'}>
              {temperatureLabel(lead.temperature)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stage selector */}
      <div>
        <SectionTitle>Estágio</SectionTitle>
        <div className="mt-3">
          <StageSelector
            stages={stages}
            currentStageId={lead.stage_id}
            onSelect={async (stageId) => {
              try {
                await onPatchLead({ stage_id: stageId })
                toast({ title: 'Estágio atualizado' })
              } catch {
                toast({ title: 'Erro ao atualizar', variant: 'destructive' })
              }
            }}
          />
        </div>
      </div>

      {/* Value (editable) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Valor Potencial</SectionTitle>
          <button
            onClick={() => setEditingValue(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
        {editingValue ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={valueDraft}
              onChange={e => setValueDraft(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-muted rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-qarvon-600"
              onKeyDown={e => { if (e.key === 'Enter') saveValue() }}
              autoFocus
            />
            <Button variant="brand" size="icon-sm" onClick={saveValue} disabled={savingValue}>
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setEditingValue(false); setValueDraft(String(lead.value ?? '')) }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <p className={cn('text-sm font-bold', lead.value ? 'text-emerald-400' : 'text-muted-foreground')}>
            {lead.value ? formatCurrency(lead.value, lead.currency) : 'Não definido'}
          </p>
        )}
      </div>

      {/* Next action (editable) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Próxima ação</SectionTitle>
          <button
            onClick={() => { setEditingNextAction(v => !v); setNextActionDraft(lead.next_action ?? '') }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
        {editingNextAction ? (
          <div className="space-y-2">
            <textarea
              value={nextActionDraft}
              onChange={e => setNextActionDraft(e.target.value)}
              placeholder="Ex: Ligar amanhã às 14h"
              rows={2}
              className="w-full resize-none bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-qarvon-600"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditingNextAction(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button variant="brand" size="sm" onClick={saveNextAction} disabled={savingNextAction}>
                <Check className="w-3.5 h-3.5 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        ) : lead.next_action ? (
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="w-3 h-3" />
              {lead.next_action_at ? formatDate(lead.next_action_at) : 'Sem prazo'}
            </div>
            <p className="text-xs text-foreground">{lead.next_action}</p>
          </div>
        ) : (
          <button
            onClick={() => setEditingNextAction(true)}
            className="text-xs text-muted-foreground hover:text-qarvon-400 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Definir próxima ação
          </button>
        )}
      </div>

      {/* Assignee selector */}
      <div>
        <SectionTitle>Responsável</SectionTitle>
        <div className="mt-3">
          <AssigneeSelector
            members={members}
            currentAssignedTo={lead.assigned_to}
            currentMember={lead.assigned_member}
            onSelect={async (memberId) => {
              try {
                await onPatchLead({ assigned_to: memberId })
                toast({ title: 'Responsável atualizado' })
              } catch {
                toast({ title: 'Erro ao atualizar', variant: 'destructive' })
              }
            }}
          />
        </div>
      </div>

      {/* Contact */}
      <div>
        <SectionTitle>Contato</SectionTitle>
        <div className="mt-3 space-y-2">
          {lead.contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{formatPhone(lead.contact.phone)}</span>
            </div>
          )}
          {lead.contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{lead.contact.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              {lead.contact.purchase_count} compras ·{' '}
              <span className="text-emerald-400 font-semibold">
                {formatCurrency(lead.contact.total_revenue)}
              </span>
            </span>
          </div>
          {lead.contact.last_purchase_at && (
            <p className="text-xs text-muted-foreground pl-5">
              Última: {formatDate(lead.contact.last_purchase_at)}
            </p>
          )}
          {lead.contact.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {lead.contact.tags.map(tag => (
                <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>
            Tarefas {pendingTasks.length > 0 && `(${pendingTasks.length})`}
          </SectionTitle>
          <button
            onClick={() => setShowTaskForm(v => !v)}
            className="text-muted-foreground hover:text-qarvon-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {showTaskForm && (
          <div className="bg-muted/50 rounded-lg p-3 mb-3 space-y-2">
            <input
              type="text"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              placeholder="Título da tarefa"
              className="w-full bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-qarvon-600"
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={taskPriority}
                onChange={e => setTaskPriority(e.target.value)}
                className="flex-1 bg-background rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
              <input
                type="datetime-local"
                value={taskDue}
                onChange={e => setTaskDue(e.target.value)}
                className="flex-1 bg-background rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowTaskForm(false)}>
                Cancelar
              </Button>
              <Button variant="brand" size="sm" onClick={submitTaskForm} disabled={!taskTitle.trim()}>
                Criar
              </Button>
            </div>
          </div>
        )}

        {pendingTasks.length === 0 && !showTaskForm ? (
          <button
            onClick={() => setShowTaskForm(true)}
            className="text-xs text-muted-foreground hover:text-qarvon-400 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Adicionar tarefa
          </button>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map(task => (
              <div key={task.id} className="flex items-start gap-2">
                <button
                  onClick={() => onCompleteTask(task.id, true)}
                  className={cn(
                    'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center hover:border-qarvon-500 transition-colors',
                    task.priority === 'urgent' ? 'border-destructive'
                      : task.priority === 'high' ? 'border-orange-400'
                      : 'border-border'
                  )}
                >
                  <Check className="w-2.5 h-2.5 opacity-0 hover:opacity-100" />
                </button>
                <div className="min-w-0">
                  <p className="text-xs text-foreground leading-tight">{task.title}</p>
                  {task.due_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-2.5 h-2.5 inline mr-1" />
                      {formatDate(task.due_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attribution summary */}
      {(lead.source || lead.ctwa_clid) && (
        <div>
          <SectionTitle>Origem</SectionTitle>
          <div className="mt-3 space-y-2 text-sm">
            {lead.source && <AttrRow label="Canal" value={lead.source} />}
            {lead.campaign?.name && <AttrRow label="Campanha" value={lead.campaign.name} />}
            {lead.creative?.name && <AttrRow label="Criativo" value={lead.creative.name} />}
            {lead.ctwa_clid && <AttrRow label="Ad Click" value="ctwa_clid ✓" highlight />}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground pt-2 border-t border-border space-y-1">
        <p>Criado {formatRelative(lead.created_at)}</p>
        <p>Atualizado {formatRelative(lead.updated_at)}</p>
      </div>
    </div>
  )
}

// ─── Stage Selector ───────────────────────────────────────────

function StageSelector({
  stages, currentStageId, onSelect,
}: {
  stages: Stage[]
  currentStageId: string | null
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = stages.find(s => s.id === currentStageId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
      >
        {current ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: current.color }} />
            <span>{current.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Sem estágio</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => { onSelect(stage.id); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
                currentStageId === stage.id && 'bg-muted'
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              <span>{stage.name}</span>
              {stage.is_won && <span className="ml-auto text-xs text-emerald-400">Ganho</span>}
              {stage.is_lost && <span className="ml-auto text-xs text-destructive">Perdido</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Assignee Selector ────────────────────────────────────────

function AssigneeSelector({
  members, currentAssignedTo, currentMember, onSelect,
}: {
  members: Member[]
  currentAssignedTo: string | null
  currentMember: Member | null
  onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-xs font-medium shrink-0">
          {(currentMember?.display_name ?? '?').charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-left">
          {currentMember?.display_name ?? 'Não atribuído'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => { onSelect(null); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Não atribuído
          </button>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
                currentAssignedTo === m.id && 'bg-muted'
              )}
            >
              <div className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-xs font-medium shrink-0">
                {(m.display_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span>{m.display_name ?? 'Sem nome'}</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize">{m.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </h3>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <Icon className="w-8 h-8 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
