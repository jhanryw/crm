'use client'

import { useState, useEffect, useMemo } from 'react'
import { Conversation, ConversationStatus } from '@/types'
import { ConversationList } from './conversation-list'
import { ConversationPanel } from './conversation-panel'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'

type StatusFilter = 'all' | 'open' | 'pending' | 'resolved' | 'unread'

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  open: 'Abertas',
  pending: 'Pendentes',
  resolved: 'Resolvidas',
  unread: 'Não lidas',
}

interface InboxViewProps {
  initialConversations: Conversation[]
}

export function InboxView({ initialConversations }: InboxViewProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  )
  const [filter, setFilter] = useState<StatusFilter>('all')

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'messaging',
        table: 'conversations',
      }, payload => {
        if (payload.eventType === 'UPDATE') {
          setConversations(prev =>
            prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
              .sort((a, b) =>
                new Date(b.last_message_at ?? 0).getTime() -
                new Date(a.last_message_at ?? 0).getTime()
              )
          )
        }
        if (payload.eventType === 'INSERT') {
          setConversations(prev => [payload.new as Conversation, ...prev])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleStatusChange(id: string, status: string) {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, status: status as ConversationStatus } : c)
    )
  }

  const filtered = useMemo(() => {
    if (filter === 'unread') return conversations.filter(c => c.is_unread)
    if (filter === 'all') return conversations.filter(c => c.status !== 'archived')
    return conversations.filter(c => c.status === filter)
  }, [conversations, filter])

  const counts = useMemo(() => ({
    all: conversations.filter(c => c.status !== 'archived').length,
    open: conversations.filter(c => c.status === 'open').length,
    pending: conversations.filter(c => c.status === 'pending').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
    unread: conversations.filter(c => c.is_unread).length,
  }), [conversations])

  const activeConversation = filtered.find(c => c.id === activeId)
    ?? conversations.find(c => c.id === activeId)

  return (
    <div className="flex h-full flex-col">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
        {(Object.keys(FILTER_LABELS) as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0',
              filter === f
                ? 'bg-qarvon-600/20 text-qarvon-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {FILTER_LABELS[f]}
            {counts[f] > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-xs',
                filter === f ? 'bg-qarvon-600/30 text-qarvon-400' : 'bg-muted text-muted-foreground',
                f === 'unread' && counts[f] > 0 && filter !== f && 'bg-red-400/20 text-red-400',
              )}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <ConversationList
          conversations={filtered}
          activeId={activeId}
          onSelect={id => {
            setActiveId(id)
            // Optimistic mark read
            setConversations(prev => prev.map(c => c.id === id ? { ...c, is_unread: false } : c))
          }}
        />
        <div className="flex-1 overflow-hidden">
          {activeConversation ? (
            <ConversationPanel
              conversation={activeConversation}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="w-10 h-10 opacity-20" />
              <p className="text-sm">
                {filtered.length === 0 ? 'Nenhuma conversa neste filtro' : 'Selecione uma conversa'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
