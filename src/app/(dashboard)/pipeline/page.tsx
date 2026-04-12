import { createClient } from '@/lib/supabase/server'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const supabase = createClient()

  const [{ data: stages }, { data: leads }] = await Promise.all([
    supabase
      .schema('crm')
      .from('pipeline_stages')
      .select('*')
      .order('position'),
    supabase
      .schema('crm')
      .from('leads')
      .select(`
        *,
        contact:crm.contacts(id, name, phone, avatar_url, total_revenue, purchase_count),
        assigned_member:crm.workspace_members(id, display_name, avatar_url)
      `)
      .eq('status', 'open')
      .order('score', { ascending: false })
      .limit(200),
  ])

  return (
    <PipelineBoard
      initialStages={(stages as any) ?? []}
      initialLeads={(leads as any) ?? []}
    />
  )
}
