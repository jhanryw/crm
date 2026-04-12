'use client'

import { Conversation } from '@/types'
import { cn, formatRelative, truncate } from '@/lib/utils'
import { MessageSquare, Instagram, Search, Filter } from 'lucide-react'
import { useState } from 'react'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(c => {
    const name = c.contact?.name ?? c.contact?.phone ?? ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="w-80 flex flex-col h-full border-r border-border bg-card shrink-0">
      {/* Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-border">
        <h2 className="font-semibold text-foreground flex-1">Inbox</h2>
        <span className="text-xs bg-qarvon-600/20 text-qarvon-400 rounded-full px-2 py-0.5">
          {conversations.filter(c => c.is_unread).length} novas
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full bg-background rounded-lg pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-qarvon-600"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma conversa
          </div>
        )}
        {filtered.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              'w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left',
              activeId === conv.id && 'bg-accent',
              conv.is_unread && 'border-l-2 border-l-qarvon-500'
            )}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                {(conv.contact?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              {/* Channel badge */}
              <div className={cn(
                'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center',
                conv.channel?.type === 'whatsapp' ? 'bg-emerald-500' : 'bg-pink-500'
              )}>
                {conv.channel?.type === 'whatsapp'
                  ? <MessageSquare className="w-2.5 h-2.5 text-white" />
                  : <Instagram className="w-2.5 h-2.5 text-white" />
                }
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={cn(
                  'text-sm truncate',
                  conv.is_unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
                )}>
                  {conv.contact?.name ?? conv.contact?.phone ?? 'Desconhecido'}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatRelative(conv.last_message_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {conv.last_message ? truncate(conv.last_message, 50) : 'Sem mensagens'}
              </p>
            </div>

            {/* Unread dot */}
            {conv.is_unread && (
              <div className="w-2 h-2 rounded-full bg-qarvon-500 shrink-0 mt-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
