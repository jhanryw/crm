import { createClient } from '@/lib/supabase/server'
import { BarChart3, TrendingUp, ExternalLink } from 'lucide-react'
import { formatCurrency, formatRelative } from '@/lib/utils'
import { subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

const platformColors: Record<string, string> = {
  meta: 'bg-blue-400/10 text-blue-400',
  google: 'bg-yellow-400/10 text-yellow-400',
  tiktok: 'bg-pink-400/10 text-pink-400',
  organic: 'bg-emerald-400/10 text-emerald-400',
}

export default async function CampaignsPage() {
  const supabase = createClient()
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [{ data: campaigns }, { data: revenue }] = await Promise.all([
    supabase
      .schema('attribution')
      .from('campaigns')
      .select('*, ad_account:ad_accounts(id, name, platform)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .schema('analytics')
      .from('campaign_revenue')
      .select('campaign_id, revenue, leads_count, conversions')
      .gte('date', since),
  ])

  // Aggregate revenue per campaign
  const revenueMap: Record<string, { revenue: number; leads: number; conversions: number }> = {}
  for (const r of revenue ?? []) {
    const id = (r as { campaign_id: string }).campaign_id
    if (!revenueMap[id]) revenueMap[id] = { revenue: 0, leads: 0, conversions: 0 }
    revenueMap[id].revenue += (r as { revenue: number }).revenue ?? 0
    revenueMap[id].leads += (r as { leads_count: number }).leads_count ?? 0
    revenueMap[id].conversions += (r as { conversions: number }).conversions ?? 0
  }

  const campaignList = (campaigns ?? []) as {
    id: string; name: string; platform: string; spend: number
    utm_campaign: string | null; objective: string | null
    created_at: string
    ad_account: { name: string; platform: string } | null
  }[]

  const sorted = [...campaignList].sort((a, b) =>
    (revenueMap[b.id]?.revenue ?? 0) - (revenueMap[a.id]?.revenue ?? 0)
  )

  const totalRevenue = Object.values(revenueMap).reduce((s, r) => s + r.revenue, 0)
  const totalSpend = campaignList.reduce((s, c) => s + c.spend, 0)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold">Campanhas</h1>
        <span className="text-xs text-muted-foreground">últimos 30 dias</span>
        <div className="ml-auto flex items-center gap-6 text-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Receita</p>
            <p className="font-semibold text-emerald-400">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">ROAS</p>
            <p className="font-semibold text-foreground">
              {totalSpend > 0 ? `${(totalRevenue / totalSpend).toFixed(2)}x` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <BarChart3 className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhuma campanha encontrada</p>
            <p className="text-xs">Conecte uma conta de anúncios para ver campanhas aqui</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Campanha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Plataforma</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Leads</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversões</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gasto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map(campaign => {
                const stats = revenueMap[campaign.id]
                const roas = campaign.spend > 0 && stats?.revenue
                  ? stats.revenue / campaign.spend
                  : null

                return (
                  <tr key={campaign.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-foreground">{campaign.name}</p>
                      {campaign.utm_campaign && (
                        <p className="text-xs text-muted-foreground font-mono">{campaign.utm_campaign}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${platformColors[campaign.platform] ?? 'bg-muted text-muted-foreground'}`}>
                        {campaign.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{stats?.leads ?? 0}</td>
                    <td className="px-4 py-3 text-right">{stats?.conversions ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                      {formatCurrency(stats?.revenue ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCurrency(campaign.spend)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {roas !== null ? (
                        <span className={roas >= 3 ? 'text-emerald-400 font-bold' : roas >= 1 ? 'text-yellow-400' : 'text-destructive'}>
                          {roas.toFixed(2)}x
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
