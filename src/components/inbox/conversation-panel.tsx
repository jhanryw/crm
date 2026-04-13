'use client'

import { useState, useEffect, useRef } from 'react'
import { Conversation, ConversationStatus, Message, Lead } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn, formatCurrency, temperatureLabel, scoreColor, formatPhone } from '@/lib/utils'
import {
  Send, Phone, Mail, ShoppingBag, Flame, Star, Target, Clock,
  MessageSquare, Instagram, ChevronRight, CheckCheck, Check as CheckIcon,
  Circle, AlertCircle, Archive, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'

interface ConversationPanelProps {
  conversation: Conversation
  onStatusChange?: (id: string, status: string) => void
}

export function ConversationPanel({ conversation, onStatusChange }: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [lead, setLead] = useState<Lead | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showLeadPanel, setShowLeadPanel] = useState(true)
  const [status, setStatus] = useState<ConversationStatus>(conversation.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    // Mark as read
    fetch(`/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_unread: false }),
    }).catch(() => {})

    // Load messages
    supabase
      .schema('messaging')
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => setMessages((data as Message[]) ?? []))

    // Load lead
    if (conversation.lead_id) {
      supabase
        .schema('crm')
        .from('leads')
        .select('*, stage:pipeline_stages(name, color)')
        .eq('id', conversation.lead_id)
        .single()
        .then(({ data }) => setLead(data as unknown as Lead))
    }

    // Real-time messages
    const channel = supabase
      .channel(`conv-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'messaging',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'messaging',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversation.id, conversation.lead_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setStatus(conversation.status as ConversationStatus)
  }, [conversation.status])

  async function handleSend() {
    if (!input.trim() || sending) return
    setSending(true)
    const text = input
    setInput('')

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          type: 'text',
          content: text,
        }),
      })
      if (!res.ok) throw new Error('Falha ao enviar')
    } catch {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' })
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  async function handleChangeStatus(newStatus: ConversationStatus) {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setStatus(newStatus)
      onStatusChange?.(conversation.id, newStatus)
      toast({ title: newStatus === 'resolved' ? 'Conversa resolvida' : 'Status atualizado' })
    } catch {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const isResolved = status === 'resolved' || status === 'archived'

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="h-14 px-4 flex items-center gap-3 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
            {(conversation.contact?.name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {conversation.contact?.name ?? conversation.contact?.phone ?? 'Desconhecido'}
            </p>
            <div className="flex items-center gap-1.5">
              {conversation.channel?.type === 'whatsapp' ? (
                <MessageSquare className="w-3 h-3 text-emerald-400" />
              ) : (
                <Instagram className="w-3 h-3 text-pink-400" />
              )}
              <span className="text-xs text-muted-foreground capitalize">
                {conversation.channel?.type}
              </span>
              {conversation.contact?.phone && (
                <span className="text-xs text-muted-foreground">
                  · {formatPhone(conversation.contact.phone)}
                </span>
              )}
            </div>
          </div>

          {/* Status actions */}
          <div className="flex items-center gap-1">
            {!isResolved ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-300"
                onClick={() => handleChangeStatus('resolved')}
                disabled={updatingStatus}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Resolver
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => handleChangeStatus('open')}
                disabled={updatingStatus}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reabrir
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-muted-foreground"
              onClick={() => handleChangeStatus('archived' as ConversationStatus)}
              disabled={updatingStatus || status === 'archived'}
            >
              <Archive className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowLeadPanel(v => !v)}
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', !showLeadPanel && 'rotate-180')} />
          </Button>
        </div>

        {/* Resolved banner */}
        {isResolved && (
          <div className="px-4 py-2 bg-emerald-400/5 border-b border-emerald-400/20 flex items-center gap-2">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">Conversa {status === 'archived' ? 'arquivada' : 'resolvida'}</p>
            <button
              onClick={() => handleChangeStatus('open' as ConversationStatus)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reabrir
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma mensagem ainda
            </div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
            >
              <div className={cn(
                'max-w-sm px-4 py-2 rounded-2xl text-sm',
                msg.direction === 'inbound'
                  ? 'bg-muted text-foreground rounded-tl-sm'
                  : 'bg-qarvon-600 text-white rounded-tr-sm'
              )}>
                {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}
                {msg.type === 'image' && msg.media_url && (
                  <img src={msg.media_url} alt="" className="rounded-lg max-w-full" />
                )}
                {msg.type === 'audio' && msg.media_url && (
                  <audio controls src={msg.media_url} className="max-w-full" />
                )}
                {!['text', 'image', 'audio'].includes(msg.type) && (
                  <span className="italic text-xs opacity-70">[{msg.type}]</span>
                )}
                <div className={cn(
                  'flex items-center gap-1 mt-1',
                  msg.direction === 'inbound' ? 'justify-start' : 'justify-end'
                )}>
                  <p className={cn(
                    'text-xs',
                    msg.direction === 'inbound' ? 'text-muted-foreground' : 'text-white/60'
                  )}>
                    {formatDate(msg.created_at)}
                  </p>
                  {msg.direction === 'outbound' && (
                    <MessageStatusIcon status={msg.status} />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          {isResolved ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <p className="text-xs text-muted-foreground">Conversa resolvida.</p>
              <button
                onClick={() => handleChangeStatus('open')}
                className="text-xs text-qarvon-400 hover:underline"
            >
                Reabrir para responder
            </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Digite uma mensagem... (Enter para enviar)"
                rows={1}
                className="flex-1 resize-none bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-qarvon-600 max-h-32"
              />
              <Button
                variant="brand"
                size="icon"
                onClick={handleSend}
                disabled={sending || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Lead context panel */}
      {showLeadPanel && conversation.contact && (
        <div className="w-72 border-l border-border bg-card overflow-y-auto shrink-0">
          <div className="p-4 space-y-5">
            {/* Contact */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contato
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{formatPhone(conversation.contact.phone)}</span>
                </div>
                {conversation.contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{conversation.contact.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>
                    {conversation.contact.purchase_count} compras ·{' '}
                    {formatCurrency(conversation.contact.total_revenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Lead intelligence */}
            {lead && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Lead Intelligence
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Star className="w-3.5 h-3.5" /> Score
                    </div>
                    <span className={cn('text-sm font-bold', scoreColor(lead.score))}>
                      {lead.score}/100
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Flame className="w-3.5 h-3.5" /> Temperatura
                    </div>
                    <Badge variant={lead.temperature as any}>
                      {temperatureLabel(lead.temperature)}
                    </Badge>
                  </div>

                  {lead.stage && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Target className="w-3.5 h-3.5" /> Estágio
                      </div>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${(lead.stage as any).color}20`, color: (lead.stage as any).color }}
                      >
                        {(lead.stage as any).name}
                      </span>
                    </div>
                  )}

                  {lead.value && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Valor potencial</span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(lead.value, lead.currency)}
                      </span>
                    </div>
                  )}

                  {lead.next_action && (
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" /> Próxima ação
                      </div>
                      <p className="text-xs text-foreground">{lead.next_action}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attribution */}
            {(conversation.ctwa_clid || lead?.source) && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Origem
                </h3>
                <div className="space-y-2 text-sm">
                  {lead?.source && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Canal</span>
                      <span className="capitalize">{lead.source}</span>
                    </div>
                  )}
                  {(lead?.campaign as any)?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Campanha</span>
                      <span className="text-xs truncate max-w-[140px]">
                        {(lead?.campaign as any)?.name}
                      </span>
                    </div>
                  )}
                  {conversation.ctwa_clid && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ad Click</span>
                      <Badge variant="success">ctwa_clid ✓</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Message status icon ──────────────────────────────────────

function MessageStatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-qarvon-400" />
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-white/60" />
  if (status === 'sent') return <CheckIcon className="w-3 h-3 text-white/60" />
  if (status === 'queued') return <Circle className="w-3 h-3 text-white/40" />
  if (status === 'failed') return <AlertCircle className="w-3 h-3 text-red-400" />
  return null
}
