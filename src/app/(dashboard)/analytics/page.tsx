import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [{ data: metrics }, { data: campaignRevenue }] = await Promise.all([
    supabase
      .schema('analytics')
      .from('daily_metrics')
      .select('*')
      .gte('date', since)
      .order('date'),
    supabase
      .schema('analytics')
      .from('campaign_revenue')
      .select(`
        *,
        campaign:attribution.campaigns(name, platform)
      `)
      .gte('date', since)
      .order('revenue', { ascending: false })
      .limit(20),
  ])

  return (
    <AnalyticsDashboard
      metrics={(metrics as any) ?? []}
      campaignRevenue={(campaignRevenue as any) ?? []}
    />
  )
}
