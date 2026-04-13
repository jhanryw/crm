import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/leads/:id/tasks/:taskId — update or complete a task
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; taskId: string } }
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

  const body = await req.json()
  const allowed: Record<string, unknown> = {}

  if ('completed' in body) {
    allowed.completed_at = body.completed ? new Date().toISOString() : null
  }
  if ('title' in body)       allowed.title = body.title
  if ('description' in body) allowed.description = body.description
  if ('priority' in body)    allowed.priority = body.priority
  if ('due_at' in body)      allowed.due_at = body.due_at
  if ('assigned_to' in body) allowed.assigned_to = body.assigned_to

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: task, error } = await supabase
    .schema('crm')
    .from('tasks')
    .update(allowed)
    .eq('id', params.taskId)
    .eq('lead_id', params.id)
    .eq('workspace_id', member.workspace_id)
    .select('*, assigned_member:workspace_members(id, display_name)')
    .single()

  if (error) {
    console.error('[PATCH /api/leads/:id/tasks/:taskId]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(task)
}

// DELETE /api/leads/:id/tasks/:taskId
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('id, workspace_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .schema('crm')
    .from('tasks')
    .delete()
    .eq('id', params.taskId)
    .eq('lead_id', params.id)
    .eq('workspace_id', member.workspace_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
