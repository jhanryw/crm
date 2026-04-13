import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  // Verify the lead exists and get workspace_id
  const { data: lead } = await supabase
    .schema('crm')
    .from('leads')
    .select('id, workspace_id')
    .eq('id', params.id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Get current member
  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('workspace_id', (lead as { workspace_id: string }).workspace_id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: note, error } = await supabase
    .schema('crm')
    .from('lead_notes')
    .insert({
      lead_id: params.id,
      workspace_id: (lead as { workspace_id: string }).workspace_id,
      author_id: (member as { id: string }).id,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also log as an activity
  await supabase
    .schema('crm')
    .from('lead_activities')
    .insert({
      lead_id: params.id,
      workspace_id: (lead as { workspace_id: string }).workspace_id,
      actor_id: (member as { id: string }).id,
      type: 'note',
      title: 'Nota adicionada',
      body: content.trim().slice(0, 120),
    })

  return NextResponse.json({ note })
}
