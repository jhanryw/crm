import { createClient } from '@/lib/supabase/server'
import { InboxView } from '@/components/inbox/inbox-view'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const supabase = createClient()

  const { data: conversations } = await supabase
    .schema('messaging')
    .from('conversations')
    .select(`
      *,
      contact:crm.contacts(*),
      channel:messaging.channels(id, type, name, phone_number),
      assigned_member:crm.workspace_members(id, display_name, avatar_url)
    `)
    .in('status', ['open', 'pending'])
    .order('last_message_at', { ascending: false })
    .limit(50)

  return <InboxView initialConversations={(conversations as any) ?? []} />
}
