import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/leads/:id/tasks — create a task
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('id, workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify lead belongs to same workspace
  const { data: lead } = await supabase
    .schema('crm')
    .from('leads')
    .select('id, workspace_id')
    .eq('id', params.id)
    .eq('workspace_id', member.workspace_id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const body = await req.json()
  const { title, description, priority = 'normal', due_at, assigned_to } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data: task, error } = await supabase
    .schema('crm')
    .from('tasks')
    .insert({
      lead_id: params.id,
      workspace_id: member.workspace_id,
      created_by: member.id,
      assigned_to: assigned_to ?? member.id,
      title: title.trim(),
      description: description ?? null,
      priority,
      due_at: due_at ?? null,
    })
    .select('*, assigned_member:workspace_members(id, display_name)')
    .single()

  if (error) {
    console.error('[POST /api/leads/:id/tasks]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(task, { status: 201 })
}
