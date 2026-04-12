import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated', userError })
  }

  // Test 1: raw query without schema
  const test1 = await supabase
    .from('workspace_members')
    .select('id')
    .limit(1)

  // Test 2: with schema
  const test2 = await (supabase as any)
    .schema('crm')
    .from('workspace_members')
    .select('id')
    .limit(1)

  // Test 3: full membership query
  const test3 = await (supabase as any)
    .schema('crm')
    .from('workspace_members')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  return NextResponse.json({
    user_id: user.id,
    test1_no_schema: { data: test1.data, error: test1.error },
    test2_with_schema: { data: test2.data, error: test2.error },
    test3_full_query: { data: test3.data, error: test3.error },
  })
}
