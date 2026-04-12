import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stage_id } = await req.json()
  if (!stage_id) return NextResponse.json({ error: 'stage_id required' }, { status: 400 })

  // Get current lead (to check workspace membership)
  const { data: lead } = await supabase
    .schema('crm')
    .from('leads')
    .select('id, workspace_id, stage_id')
    .eq('id', params.id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get member
  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('id, display_name')
    .eq('user_id', user.id)
    .eq('workspace_id', lead.workspace_id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get stage names for activity log
  const { data: newStage } = await supabase
    .schema('crm')
    .from('pipeline_stages')
    .select('name, is_won, is_lost')
    .eq('id', stage_id)
    .single()

  // Update lead
  const updateData: Record<string, unknown> = { stage_id }
  if (newStage?.is_won) {
    updateData.status = 'won'
    updateData.won_at = new Date().toISOString()
  } else if (newStage?.is_lost) {
    updateData.status = 'lost'
    updateData.lost_at = new Date().toISOString()
  }

  await supabase
    .schema('crm')
    .from('leads')
    .update(updateData)
    .eq('id', params.id)

  // Log activity
  await supabase
    .schema('crm')
    .from('lead_activities')
    .insert({
      lead_id: params.id,
      workspace_id: lead.workspace_id,
      actor_id: member.id,
      type: 'stage_change',
      title: `Movido para ${newStage?.name ?? stage_id}`,
    })

  return NextResponse.json({ success: true })
}
