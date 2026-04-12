import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from '@/components/leads/leads-table'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = createClient()

  const { data: leads } = await supabase
    .schema('crm')
    .from('leads')
    .select(`
      *,
      contact:crm.contacts(id, name, phone, email, avatar_url, total_revenue, purchase_count, last_purchase_at),
      stage:crm.pipeline_stages(id, name, color),
      assigned_member:crm.workspace_members(id, display_name, avatar_url),
      campaign:attribution.campaigns(id, name, platform)
    `)
    .in('status', ['open', 'won'])
    .order('score', { ascending: false })
    .limit(100)

  return <LeadsTable initialLeads={(leads as any) ?? []} />
}
