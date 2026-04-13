import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/leads/:id — update lead fields (stage, assignee, value, next_action, status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify membership
  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Allow-listed fields only
  const allowed = [
    'stage_id', 'assigned_to', 'value', 'currency', 'next_action',
    'next_action_at', 'status', 'lost_reason', 'title', 'source', 'notes',
  ] as const

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Auto-set won_at / lost_at when status changes
  if (update.status === 'won' && !update.won_at) update.won_at = new Date().toISOString()
  if (update.status === 'lost' && !update.lost_at) update.lost_at = new Date().toISOString()

  const { data: lead, error } = await supabase
    .schema('crm')
    .from('leads')
    .update(update)
    .eq('id', params.id)
    .eq('workspace_id', member.workspace_id)
    .select('id, stage_id, assigned_to, value, status, next_action, next_action_at, title')
    .single()

  if (error) {
    console.error('[PATCH /api/leads/:id]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log activity for meaningful changes
  const activityInserts: Array<{
    lead_id: string
    workspace_id: string
    actor_id: string
    type: string
    title: string
    body: string | null
    metadata: Record<string, unknown>
  }> = []

  if ('stage_id' in update) {
    activityInserts.push({
      lead_id: params.id,
      workspace_id: member.workspace_id,
      actor_id: user.id,
      type: 'stage_change',
      title: 'Estágio atualizado',
      body: null,
      metadata: { new_stage_id: update.stage_id },
    })
  }

  if ('assigned_to' in update) {
    activityInserts.push({
      lead_id: params.id,
      workspace_id: member.workspace_id,
      actor_id: user.id,
      type: 'assignment',
      title: 'Responsável alterado',
      body: null,
      metadata: { new_assignee: update.assigned_to },
    })
  }

  if ('status' in update) {
    activityInserts.push({
      lead_id: params.id,
      workspace_id: member.workspace_id,
      actor_id: user.id,
      type: 'stage_change',
      title: update.status === 'won' ? 'Lead marcado como Ganho' : 'Lead marcado como Perdido',
      body: (update.lost_reason as string | null) ?? null,
      metadata: { new_status: update.status },
    })
  }

  if (activityInserts.length > 0) {
    await supabase.schema('crm').from('lead_activities').insert(activityInserts)
  }

  return NextResponse.json(lead)
}
