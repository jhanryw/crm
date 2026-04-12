// ============================================================
// Scoring Worker — recomputes lead scores every 15 minutes
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { computeLeadScore, suggestNextAction } from '@/lib/scoring/engine'
import { LeadScoreFactors } from '@/types'
import { differenceInDays } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function scoringWorker() {
  console.log('[ScoringWorker] Starting...')

  try {
    // Get all open leads with context
    const { data: leads, error } = await supabase
      .schema('crm')
      .from('leads')
      .select(`
        id, workspace_id, score, temperature, stage_id, contact_id,
        source, ctwa_clid, created_at,
        contact:crm.contacts(phone, email, total_revenue, purchase_count, last_purchase_at),
        stage:crm.pipeline_stages(position),
        last_message:messaging.conversations(
          last_message_at,
          messages:messaging.messages(id)
        )
      `)
      .eq('status', 'open')
      .limit(1000)

    if (error) throw error
    if (!leads) return

    // Get max stage position per workspace (for relative scoring)
    const { data: maxStages } = await supabase
      .schema('crm')
      .from('pipeline_stages')
      .select('workspace_id, position')
      .order('position', { ascending: false })

    const maxStageMap: Record<string, number> = {}
    for (const s of maxStages ?? []) {
      if (!maxStageMap[s.workspace_id] || s.position > maxStageMap[s.workspace_id]) {
        maxStageMap[s.workspace_id] = s.position
      }
    }

    let updated = 0

    for (const lead of leads) {
      try {
        const contact = lead.contact as any
        const stage = lead.stage as any
        const conversations = lead.last_message as any[]

        // Find last message timestamp
        const lastMsgAt = conversations
          ?.flatMap(c => [c.last_message_at])
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? null

        const messagesCount = conversations
          ?.flatMap(c => c.messages ?? [])
          .length ?? 0

        const daysSinceLastMessage = lastMsgAt
          ? differenceInDays(new Date(), new Date(lastMsgAt))
          : null

        const factors: LeadScoreFactors = {
          has_phone: !!contact?.phone,
          has_email: !!contact?.email,
          purchase_count: contact?.purchase_count ?? 0,
          total_revenue: contact?.total_revenue ?? 0,
          days_since_last_message: daysSinceLastMessage,
          days_since_created: differenceInDays(new Date(), new Date(lead.created_at)),
          campaign_source: !!lead.source && lead.source !== 'organic',
          ctwa_clid: !!lead.ctwa_clid,
          messages_count: messagesCount,
          stage_position: stage?.position ?? 0,
          max_stage_position: maxStageMap[lead.workspace_id] ?? 6,
        }

        const { score, temperature } = computeLeadScore(factors)
        const nextAction = suggestNextAction(
          score,
          temperature,
          daysSinceLastMessage,
          contact?.purchase_count ?? 0
        )

        // Only update if score changed
        if (score !== lead.score || temperature !== lead.temperature) {
          await supabase
            .schema('crm')
            .from('leads')
            .update({ score, temperature, next_action: nextAction })
            .eq('id', lead.id)

          updated++
        }
      } catch (leadErr) {
        console.error(`[ScoringWorker] Error scoring lead ${lead.id}:`, leadErr)
      }
    }

    console.log(`[ScoringWorker] Done. Updated ${updated}/${leads.length} leads.`)
  } catch (err) {
    console.error('[ScoringWorker] Fatal error:', err)
  }
}
