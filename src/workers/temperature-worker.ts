// ============================================================
// Temperature Worker — sends alerts for hot/burning leads
// that haven't been attended in > 2 hours
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { differenceInHours } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function temperatureWorker() {
  console.log('[TempWorker] Checking hot leads...')

  try {
    // Find hot/burning leads with unanswered conversations
    const { data: convs } = await supabase
      .schema('messaging')
      .from('conversations')
      .select(`
        id, workspace_id, assigned_to, last_message_at, is_unread,
        lead:crm.leads(id, temperature, score, next_action)
      `)
      .eq('status', 'open')
      .eq('is_unread', true)
      .not('lead', 'is', null)

    if (!convs) return

    const now = new Date()
    const alerts: Array<{
      workspace_id: string
      assigned_to: string | null
      lead_id: string
      temperature: string
      hours_waiting: number
    }> = []

    for (const conv of convs) {
      const lead = (conv.lead as any)
      if (!lead) continue
      if (!['hot', 'burning'].includes(lead.temperature)) continue

      const hoursWaiting = conv.last_message_at
        ? differenceInHours(now, new Date(conv.last_message_at))
        : 0

      if (hoursWaiting >= 2) {
        alerts.push({
          workspace_id: conv.workspace_id,
          assigned_to: conv.assigned_to,
          lead_id: lead.id,
          temperature: lead.temperature,
          hours_waiting: hoursWaiting,
        })
      }
    }

    // Log alerts (in production, send to notification service / Slack / email)
    if (alerts.length > 0) {
      console.log(`[TempWorker] ${alerts.length} hot leads waiting > 2h:`, alerts)
      // TODO: integrate with notification system (Slack, push, email)
    }

    console.log('[TempWorker] Done.')
  } catch (err) {
    console.error('[TempWorker] Error:', err)
  }
}
