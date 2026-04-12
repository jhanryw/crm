'use client'

import { useState, useEffect } from 'react'
import { Conversation } from '@/types'
import { ConversationList } from './conversation-list'
import { ConversationPanel } from './conversation-panel'
import { createClient } from '@/lib/supabase/client'

interface InboxViewProps {
  initialConversations: Conversation[]
}

export function InboxView({ initialConversations }: InboxViewProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  )

  // Real-time subscription to new messages
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'messaging',
          table: 'conversations',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setConversations(prev =>
              prev.map(c =>
                c.id === payload.new.id ? { ...c, ...payload.new } : c
              ).sort((a, b) =>
                new Date(b.last_message_at ?? 0).getTime() -
                new Date(a.last_message_at ?? 0).getTime()
              )
            )
          }
          if (payload.eventType === 'INSERT') {
            setConversations(prev => [payload.new as Conversation, ...prev])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const activeConversation = conversations.find(c => c.id === activeId)

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
      />
      <div className="flex-1 overflow-hidden">
        {activeConversation ? (
          <ConversationPanel conversation={activeConversation} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  )
}
