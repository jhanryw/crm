import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/conversations/:id — mark read, change status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, unknown> = {}

  if ('is_unread' in body) update.is_unread = Boolean(body.is_unread)
  if ('status' in body) {
    const allowed = ['open', 'pending', 'resolved', 'archived']
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = body.status
  }
  if ('assigned_to' in body) update.assigned_to = body.assigned_to

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('messaging')
    .from('conversations')
    .update(update)
    .eq('id', params.id)
    .eq('workspace_id', member.workspace_id)
    .select('id, status, is_unread, assigned_to')
    .single()

  if (error) {
    console.error('[PATCH /api/conversations/:id]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
