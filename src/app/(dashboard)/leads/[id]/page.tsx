import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LeadDetail } from '@/components/leads/lead-detail'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  // Load lead with same-schema relations only (avoid cross-schema ParserError)
  const { data: lead } = await supabase
    .schema('crm')
    .from('leads')
    .select(`
      *,
      contact:contacts(*),
      stage:pipeline_stages(id, name, color, position, is_won, is_lost),
      assigned_member:workspace_members(id, display_name, avatar_url, role)
    `)
    .eq('id', params.id)
    .single()

  if (!lead) notFound()

  const leadRow = lead as unknown as {
    id: string; contact_id: string; campaign_id: string | null; creative_id: string | null
  }

  // Load campaign and creative separately
  const [{ data: campaign }, { data: creative }] = await Promise.all([
    leadRow.campaign_id
      ? supabase.schema('attribution').from('campaigns')
          .select('id, name, platform, utm_campaign')
          .eq('id', leadRow.campaign_id).single()
      : Promise.resolve({ data: null }),
    leadRow.creative_id
      ? supabase.schema('attribution').from('creatives')
          .select('id, name, utm_content')
          .eq('id', leadRow.creative_id).single()
      : Promise.resolve({ data: null }),
  ])

  const fullLead = { ...lead, campaign: campaign ?? null, creative: creative ?? null }

  // Load all pipeline stages for the stage selector
  const { data: stages } = await supabase
    .schema('crm')
    .from('pipeline_stages')
    .select('id, name, color, position, is_won, is_lost')
    .order('position')

  // Load workspace members for assignment
  const { data: members } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('id, display_name, avatar_url, role')
    .eq('is_active', true)

  // Load activities (timeline)
  const { data: activities } = await supabase
    .schema('crm')
    .from('lead_activities')
    .select('*, actor:workspace_members(id, display_name, avatar_url)')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Load notes
  const { data: notes } = await supabase
    .schema('crm')
    .from('lead_notes')
    .select('*, author:workspace_members(id, display_name, avatar_url)')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })

  // Load tasks
  const { data: tasks } = await supabase
    .schema('crm')
    .from('tasks')
    .select('*, assigned_member:workspace_members(id, display_name)')
    .eq('lead_id', params.id)
    .order('due_at', { ascending: true, nullsFirst: false })

  // Load conversations + messages for this lead
  const { data: conversations } = await supabase
    .schema('messaging')
    .from('conversations')
    .select(`
      id, channel_id, external_id, status, created_at,
      channel:channels(id, type, name)
    `)
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })

  const convIds = (conversations ?? []).map((c: { id: string }) => c.id)
  const { data: messages } = convIds.length > 0
    ? await supabase
        .schema('messaging')
        .from('messages')
        .select('id, conversation_id, direction, sender_type, type, content, media_url, status, created_at, sender_agent:workspace_members(id, display_name)')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  // Load touch events (attribution)
  const { data: touchEvents } = await supabase
    .schema('attribution')
    .from('touch_events')
    .select('*, campaign:campaigns(id, name, platform), creative:creatives(id, name)')
    .eq('lead_id', params.id)
    .order('event_at', { ascending: false })

  // Load ERP sale events via contact
  const contactId = leadRow.contact_id
  const { data: saleEvents } = await supabase
    .schema('crm')
    .from('erp_sale_events')
    .select('id, event_type, payload, processed, processed_at, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Load CAPI events
  const { data: capiEvents } = await supabase
    .schema('capi_queue')
    .from('events')
    .select('id, platform, event_name, status, attempts, created_at, sent_at')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <LeadDetail
      lead={fullLead as any}
      stages={(stages as any) ?? []}
      members={(members as any) ?? []}
      activities={(activities as any) ?? []}
      notes={(notes as any) ?? []}
      tasks={(tasks as any) ?? []}
      conversations={(conversations as any) ?? []}
      messages={(messages as any) ?? []}
      touchEvents={(touchEvents as any) ?? []}
      saleEvents={(saleEvents as any) ?? []}
      capiEvents={(capiEvents as any) ?? []}
    />
  )
}
