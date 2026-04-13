// ============================================================
// Temperature Worker — persists alerts for hot/burning leads
// that haven't been replied to in > 2 hours
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { differenceInHours } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ConvRow {
  id: string
  workspace_id: string
  assigned_to: string | null
  last_message_at: string | null
  lead_id: string | null
}

interface LeadRow {
  id: string
  temperature: string
  score: number
  next_action: string | null
}

export async function temperatureWorker() {
  console.log('[TempWorker] Checking hot leads...')

  try {
    // Fetch open unread conversations (no cross-schema join — separate query instead)
    const { data: rawConvs } = await supabase
      .schema('messaging')
      .from('conversations')
      .select('id, workspace_id, assigned_to, last_message_at, lead_id')
      .eq('status', 'open')
      .eq('is_unread', true)
      .not('lead_id', 'is', null)

    const convs = (rawConvs ?? []) as ConvRow[]
    if (convs.length === 0) return

    const leadIds = convs.map(c => c.lead_id!).filter(Boolean)

    const { data: rawLeads } = await supabase
      .schema('crm')
      .from('leads')
      .select('id, temperature, score, next_action')
      .in('id', leadIds)
      .in('temperature', ['hot', 'burning'])

    const leads = (rawLeads ?? []) as LeadRow[]
    const leadMap = new Map(leads.map(l => [l.id, l]))

    const now = new Date()
    const newAlerts: Array<{
      workspace_id: string
      lead_id: string
      type: string
      severity: string
      title: string
      body: string
      metadata: Record<string, unknown>
    }> = []

    for (const conv of convs) {
      if (!conv.lead_id) continue
      const lead = leadMap.get(conv.lead_id)
      if (!lead) continue

      const hoursWaiting = conv.last_message_at
        ? differenceInHours(now, new Date(conv.last_message_at))
        : 0

      if (hoursWaiting >= 2) {
        newAlerts.push({
          workspace_id: conv.workspace_id,
          lead_id: lead.id,
          type: 'hot_no_reply',
          severity: lead.temperature === 'burning' ? 'critical' : 'warning',
          title: `Lead ${lead.temperature === 'burning' ? '🔥 em chamas' : '🌡️ quente'} sem resposta`,
          body: `${hoursWaiting}h sem resposta. Score: ${lead.score}.`,
          metadata: {
            conversation_id: conv.id,
            assigned_to: conv.assigned_to,
            hours_waiting: hoursWaiting,
          },
        })
      }
    }

    if (newAlerts.length > 0) {
      // Persist alerts — dedup by lead_id + type within last 4h to avoid spam
      const { data: existing } = await supabase
        .schema('crm')
        .from('alerts')
        .select('lead_id, type')
        .in('lead_id', newAlerts.map(a => a.lead_id))
        .eq('type', 'hot_no_reply')
        .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())

      const existingKeys = new Set(
        (existing ?? []).map((e: { lead_id: string; type: string }) => `${e.lead_id}:${e.type}`)
      )

      const toInsert = newAlerts.filter(
        a => !existingKeys.has(`${a.lead_id}:${a.type}`)
      )

      if (toInsert.length > 0) {
        await supabase.schema('crm').from('alerts').insert(toInsert)
        console.log(`[TempWorker] Created ${toInsert.length} new alerts.`)
      }
    }

    console.log(`[TempWorker] Done. ${newAlerts.length} hot leads waiting > 2h.`)
  } catch (err) {
    console.error('[TempWorker] Error:', err)
  }
}
