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

// Local types for query results
interface ScoredLead {
  id: string
  workspace_id: string
  score: number
  temperature: string
  stage_id: string | null
  contact_id: string
  source: string | null
  ctwa_clid: string | null
  created_at: string
  contact: {
    phone: string | null
    email: string | null
    total_revenue: number
    purchase_count: number
    last_purchase_at: string | null
  } | null
  stage: {
    position: number
  } | null
}

interface ConvRow {
  lead_id: string | null
  last_message_at: string | null
}

export async function scoringWorker() {
  console.log('[ScoringWorker] Starting...')

  try {
    // Use same-schema relation names (no crm. prefix) to avoid TypeScript ParserError
    const { data: rawLeads, error } = await supabase
      .schema('crm')
      .from('leads')
      .select(`
        id, workspace_id, score, temperature, stage_id, contact_id,
        source, ctwa_clid, created_at,
        contact:contacts(phone, email, total_revenue, purchase_count, last_purchase_at),
        stage:pipeline_stages(position)
      `)
      .eq('status', 'open')
      .limit(1000)

    if (error) throw error
    if (!rawLeads) return

    const leads = rawLeads as unknown as ScoredLead[]

    // Get max stage position per workspace
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

    // Batch-fetch last_message_at for all open leads (cross-schema, separate query)
    const leadIds = leads.map(l => l.id)
    const { data: rawConvs } = await supabase
      .schema('messaging')
      .from('conversations')
      .select('lead_id, last_message_at')
      .in('lead_id', leadIds)

    const convs = (rawConvs ?? []) as ConvRow[]
    const convMap = new Map<string, string>()
    for (const c of convs) {
      if (c.lead_id && c.last_message_at) {
        const existing = convMap.get(c.lead_id)
        if (!existing || c.last_message_at > existing) {
          convMap.set(c.lead_id, c.last_message_at)
        }
      }
    }

    // Count messages per lead
    const { data: rawMsgCounts } = await supabase
      .schema('messaging')
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convs.map(c => c.lead_id ?? '').filter(Boolean))

    // Map lead → message count via conversations
    const msgCount: Record<string, number> = {}
    for (const c of convs) {
      if (!c.lead_id) continue
      msgCount[c.lead_id] = (rawMsgCounts ?? []).filter(
        m => m.conversation_id === c.lead_id
      ).length
    }

    let updated = 0

    for (const lead of leads) {
      try {
        const contact = lead.contact
        const stage = lead.stage
        const lastMsgAt = convMap.get(lead.id) ?? null

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
          messages_count: msgCount[lead.id] ?? 0,
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
