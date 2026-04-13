// ============================================================
// Metrics Worker — computes daily_metrics snapshot
// Runs every hour; upserts today's row.
// Also updates analytics.campaign_revenue and agent_daily_metrics.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { format, startOfDay, endOfDay } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function metricsWorker() {
  console.log('[MetricsWorker] Computing daily metrics...')

  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const dayStart = startOfDay(new Date()).toISOString()
    const dayEnd = endOfDay(new Date()).toISOString()

    // Get all workspaces
    const { data: workspaces } = await supabase
      .schema('crm')
      .from('workspaces')
      .select('id')

    if (!workspaces) return

    for (const ws of workspaces) {
      const wsId = ws.id
      await computeWorkspaceMetrics(wsId, today, dayStart, dayEnd)
    }

    console.log(`[MetricsWorker] Done. Updated ${workspaces.length} workspaces.`)
  } catch (err) {
    console.error('[MetricsWorker] Error:', err)
  }
}

async function computeWorkspaceMetrics(
  wsId: string,
  today: string,
  dayStart: string,
  dayEnd: string,
) {
  const [
    { count: newLeads },
    { count: leadsWon },
    { count: leadsLost },
    { data: wonLeads },
    { count: convsStarted },
    { count: msgsSent },
    { count: msgsReceived },
    { data: saleEvents },
    { data: allMessages },
  ] = await Promise.all([
    supabase.schema('crm').from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase.schema('crm').from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).eq('status', 'won').gte('won_at', dayStart).lte('won_at', dayEnd),
    supabase.schema('crm').from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).eq('status', 'lost').gte('lost_at', dayStart).lte('lost_at', dayEnd),
    // Won leads with attribution data to compute revenue breakdowns
    supabase.schema('crm').from('leads')
      .select('value, source, campaign_id, assigned_to')
      .eq('workspace_id', wsId).eq('status', 'won')
      .gte('won_at', dayStart).lte('won_at', dayEnd),
    supabase.schema('messaging').from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase.schema('messaging').from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).eq('direction', 'outbound').gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase.schema('messaging').from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).eq('direction', 'inbound').gte('created_at', dayStart).lte('created_at', dayEnd),
    // ERP sale events processed today (source of truth for revenue)
    supabase.schema('crm').from('erp_sale_events')
      .select('payload, event_type')
      .eq('workspace_id', wsId).eq('processed', true)
      .gte('created_at', dayStart).lte('created_at', dayEnd)
      .in('event_type', ['sale.created', 'sale.updated']),
    // Messages for avg response time calculation
    supabase.schema('messaging').from('messages')
      .select('conversation_id, direction, created_at, sender_agent_id')
      .eq('workspace_id', wsId)
      .gte('created_at', dayStart).lte('created_at', dayEnd)
      .order('created_at', { ascending: true }),
  ])

  // ── Revenue from ERP sale events (canonical) ──────────────
  let totalRevenue = 0
  const revByChannel: Record<string, number> = {}
  const revByCampaign: Record<string, number> = {}

  for (const ev of saleEvents ?? []) {
    const payload = ev.payload as Record<string, unknown>
    const amount = Number(payload?.total ?? 0)
    if (amount > 0) totalRevenue += amount
  }

  // Revenue by source (from won leads)
  for (const lead of wonLeads ?? []) {
    const val = Number(lead.value ?? 0)
    if (val <= 0) continue
    const src = (lead.source as string | null) ?? 'organic'
    revByChannel[src] = (revByChannel[src] ?? 0) + val
    if (lead.campaign_id) {
      revByCampaign[lead.campaign_id as string] = (revByCampaign[lead.campaign_id as string] ?? 0) + val
    }
  }

  // ── Revenue by lead source as fallback if ERP total is 0 ──
  const revenueWon = (wonLeads ?? []).reduce((s: number, l: any) => s + (Number(l.value) ?? 0), 0)
  const finalRevenue = totalRevenue > 0 ? totalRevenue : revenueWon

  // ── Leads by source ────────────────────────────────────────
  const { data: recentLeads } = await supabase.schema('crm').from('leads')
    .select('source')
    .eq('workspace_id', wsId).gte('created_at', dayStart).lte('created_at', dayEnd)

  const leadsBySource: Record<string, number> = {}
  for (const l of recentLeads ?? []) {
    const src = (l.source as string | null) ?? 'direct'
    leadsBySource[src] = (leadsBySource[src] ?? 0) + 1
  }

  // ── Avg response time ──────────────────────────────────────
  // Find first agent reply after each inbound message per conversation
  const msgs = (allMessages ?? []) as Array<{
    conversation_id: string
    direction: string
    created_at: string
    sender_agent_id: string | null
  }>

  const responseTimes: number[] = []
  const convMsgs: Record<string, typeof msgs> = {}
  for (const m of msgs) {
    if (!convMsgs[m.conversation_id]) convMsgs[m.conversation_id] = []
    convMsgs[m.conversation_id].push(m)
  }

  for (const convMessages of Object.values(convMsgs)) {
    for (let i = 0; i < convMessages.length - 1; i++) {
      const curr = convMessages[i]
      const next = convMessages[i + 1]
      if (curr.direction === 'inbound' && next.direction === 'outbound') {
        const diffMs = new Date(next.created_at).getTime() - new Date(curr.created_at).getTime()
        const diffSec = Math.floor(diffMs / 1000)
        if (diffSec > 0 && diffSec < 86400) {
          // Ignore responses > 24h (probably not the same thread)
          responseTimes.push(diffSec)
        }
      }
    }
  }

  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null

  // ── Agent metrics ──────────────────────────────────────────
  const agentMetrics: Record<string, {
    agent_id: string
    conversations_handled: number
    messages_sent: number
    avg_response_time_s: number
    leads_closed: number
    revenue: number
  }> = {}

  // Messages sent per agent today
  const { data: agentMsgs } = await supabase.schema('messaging').from('messages')
    .select('sender_agent_id, conversation_id')
    .eq('workspace_id', wsId).eq('direction', 'outbound')
    .gte('created_at', dayStart).lte('created_at', dayEnd)
    .not('sender_agent_id', 'is', null)

  for (const m of agentMsgs ?? []) {
    const agentId = m.sender_agent_id as string
    if (!agentMetrics[agentId]) {
      agentMetrics[agentId] = {
        agent_id: agentId,
        conversations_handled: 0,
        messages_sent: 0,
        avg_response_time_s: 0,
        leads_closed: 0,
        revenue: 0,
      }
    }
    agentMetrics[agentId].messages_sent++
  }

  // Leads won per agent today
  for (const lead of wonLeads ?? []) {
    if (!lead.assigned_to) continue
    const agentId = lead.assigned_to as string
    if (!agentMetrics[agentId]) {
      agentMetrics[agentId] = {
        agent_id: agentId,
        conversations_handled: 0,
        messages_sent: 0,
        avg_response_time_s: 0,
        leads_closed: 0,
        revenue: 0,
      }
    }
    agentMetrics[agentId].leads_closed++
    agentMetrics[agentId].revenue += Number(lead.value ?? 0)
  }

  // ── Upsert daily_metrics ───────────────────────────────────
  await supabase
    .schema('analytics')
    .from('daily_metrics')
    .upsert({
      workspace_id: wsId,
      date: today,
      new_leads: newLeads ?? 0,
      leads_won: leadsWon ?? 0,
      leads_lost: leadsLost ?? 0,
      revenue: finalRevenue,
      revenue_won: revenueWon,
      conversations_started: convsStarted ?? 0,
      messages_sent: msgsSent ?? 0,
      messages_received: msgsReceived ?? 0,
      avg_response_time_s: avgResponseTime,
      revenue_by_channel: revByChannel,
      revenue_by_campaign: revByCampaign,
      leads_by_source: leadsBySource,
      agent_metrics: agentMetrics,
    }, { onConflict: 'workspace_id,date' })

  // ── Upsert campaign_revenue ───────────────────────────────
  // Group won leads by campaign_id
  const campaignRevMap: Record<string, { revenue: number; conversions: number }> = {}
  for (const lead of wonLeads ?? []) {
    const cId = (lead.campaign_id as string | null) ?? '__organic__'
    if (!campaignRevMap[cId]) campaignRevMap[cId] = { revenue: 0, conversions: 0 }
    campaignRevMap[cId].revenue += Number(lead.value ?? 0)
    campaignRevMap[cId].conversions++
  }

  for (const [campaignId, stats] of Object.entries(campaignRevMap)) {
    await supabase
      .schema('analytics')
      .from('campaign_revenue')
      .upsert({
        workspace_id: wsId,
        campaign_id: campaignId === '__organic__' ? null : campaignId,
        creative_id: null,
        date: today,
        leads_count: 0, // will be updated below
        conversions: stats.conversions,
        revenue: stats.revenue,
      }, { onConflict: 'workspace_id,campaign_id,creative_id,date' })
  }

  // Count leads created today per campaign
  const { data: todayLeadsByCampaign } = await supabase.schema('crm').from('leads')
    .select('campaign_id')
    .eq('workspace_id', wsId).gte('created_at', dayStart).lte('created_at', dayEnd)
    .not('campaign_id', 'is', null)

  const leadsCountMap: Record<string, number> = {}
  for (const l of todayLeadsByCampaign ?? []) {
    const cId = l.campaign_id as string
    leadsCountMap[cId] = (leadsCountMap[cId] ?? 0) + 1
  }

  for (const [campaignId, count] of Object.entries(leadsCountMap)) {
    await supabase
      .schema('analytics')
      .from('campaign_revenue')
      .upsert({
        workspace_id: wsId,
        campaign_id: campaignId,
        creative_id: null,
        date: today,
        leads_count: count,
        conversions: campaignRevMap[campaignId]?.conversions ?? 0,
        revenue: campaignRevMap[campaignId]?.revenue ?? 0,
      }, { onConflict: 'workspace_id,campaign_id,creative_id,date' })
  }

  // ── Upsert agent_daily_metrics ─────────────────────────────
  for (const agent of Object.values(agentMetrics)) {
    await supabase
      .schema('analytics')
      .from('agent_daily_metrics')
      .upsert({
        workspace_id: wsId,
        agent_id: agent.agent_id,
        date: today,
        messages_sent: agent.messages_sent,
        leads_closed: agent.leads_closed,
        revenue: agent.revenue,
      }, { onConflict: 'workspace_id,agent_id,date' })
  }
}
