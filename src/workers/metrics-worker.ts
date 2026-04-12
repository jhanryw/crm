// ============================================================
// Metrics Worker — computes daily_metrics snapshot
// Runs every hour; upserts today's row.
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

      const [
        { count: newLeads },
        { count: leadsWon },
        { count: leadsLost },
        { data: wonLeadsValue },
        { count: convsStarted },
        { count: msgsSent },
        { count: msgsReceived },
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
        supabase.schema('crm').from('leads')
          .select('value').eq('workspace_id', wsId).eq('status', 'won')
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
      ])

      const revenueWon = (wonLeadsValue ?? []).reduce((s: number, l: any) => s + (l.value ?? 0), 0)

      await supabase
        .schema('analytics')
        .from('daily_metrics')
        .upsert({
          workspace_id: wsId,
          date: today,
          new_leads: newLeads ?? 0,
          leads_won: leadsWon ?? 0,
          leads_lost: leadsLost ?? 0,
          revenue_won: revenueWon,
          conversations_started: convsStarted ?? 0,
          messages_sent: msgsSent ?? 0,
          messages_received: msgsReceived ?? 0,
        }, { onConflict: 'workspace_id,date' })
    }

    console.log(`[MetricsWorker] Done. Updated ${workspaces.length} workspaces.`)
  } catch (err) {
    console.error('[MetricsWorker] Error:', err)
  }
}
