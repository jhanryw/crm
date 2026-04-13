'use client'

import { useState, useMemo } from 'react'
import { DailyMetrics } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, Users, MessageSquare, ShoppingBag, Clock, Target, ChevronDown } from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface AnalyticsDashboardProps {
  metrics: DailyMetrics[]
  campaignRevenue: Array<{
    campaign: { name: string; platform: string } | null
    revenue: number
    conversions: number
    spend: number
    roas: number
  }>
}

type Period = '7d' | '14d' | '30d' | '90d'
const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '14d': '14 dias',
  '30d': '30 dias',
  '90d': '90 dias',
}

const COLORS = ['#3b52ff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

export function AnalyticsDashboard({ metrics, campaignRevenue }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const [periodOpen, setPeriodOpen] = useState(false)
  const [agentTab, setAgentTab] = useState(false)

  const days = parseInt(period)
  const cutoff = subDays(new Date(), days).toISOString().split('T')[0]

  const filteredMetrics = useMemo(
    () => metrics.filter(m => m.date >= cutoff),
    [metrics, cutoff]
  )

  const totalRevenue = filteredMetrics.reduce((s, m) => s + (m.revenue ?? 0), 0)
  const totalLeads = filteredMetrics.reduce((s, m) => s + m.new_leads, 0)
  const totalWon = filteredMetrics.reduce((s, m) => s + m.leads_won, 0)
  const totalConvos = filteredMetrics.reduce((s, m) => s + m.conversations_started, 0)
  const avgResponseRaw = filteredMetrics.filter(m => m.avg_response_time_s).map(m => m.avg_response_time_s!)
  const avgResponse = avgResponseRaw.length > 0
    ? Math.round(avgResponseRaw.reduce((a, b) => a + b, 0) / avgResponseRaw.length)
    : null
  const conversionRate = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : '0'

  const chartData = filteredMetrics.map(m => ({
    date: format(parseISO(m.date), 'dd/MM', { locale: ptBR }),
    receita: m.revenue ?? 0,
    leads: m.new_leads,
    ganhos: m.leads_won,
  }))

  const channelData = filteredMetrics.length > 0
    ? Object.entries(
        filteredMetrics.reduce((acc, m) => {
          Object.entries(m.revenue_by_channel ?? {}).forEach(([k, v]) => {
            acc[k] = (acc[k] ?? 0) + (v as number)
          })
          return acc
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value }))
    : []

  // Agent performance aggregated from metrics
  const agentPerf = useMemo(() => {
    const map: Record<string, {
      agent_id: string
      messages_sent: number
      leads_closed: number
      revenue: number
    }> = {}
    for (const m of filteredMetrics) {
      for (const [aid, agent] of Object.entries(m.agent_metrics ?? {})) {
        if (!map[aid]) map[aid] = { agent_id: aid, messages_sent: 0, leads_closed: 0, revenue: 0 }
        map[aid].messages_sent += (agent as any).messages_sent ?? 0
        map[aid].leads_closed += (agent as any).leads_closed ?? 0
        map[aid].revenue += (agent as any).revenue ?? 0
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [filteredMetrics])

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {filteredMetrics.length} dias de dados
            </p>
          </div>
          {/* Period selector */}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              {PERIOD_LABELS[period]}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {periodOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setPeriodOpen(false) }}
                    className={cn(
                      'w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors',
                      period === p && 'bg-muted text-qarvon-400'
                    )}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard label="Receita Total" value={formatCurrency(totalRevenue)} icon={<ShoppingBag className="w-4 h-4" />} color="emerald" />
          <KPICard label="Novos Leads" value={totalLeads.toString()} icon={<Users className="w-4 h-4" />} color="blue" />
          <KPICard label="Conversões" value={totalWon.toString()} icon={<TrendingUp className="w-4 h-4" />} color="purple" />
          <KPICard label="Conversas" value={totalConvos.toString()} icon={<MessageSquare className="w-4 h-4" />} color="pink" />
          <KPICard
            label="Taxa de Fechamento"
            value={`${conversionRate}%`}
            icon={<Target className="w-4 h-4" />}
            color="orange"
          />
          <KPICard
            label="T. Médio Resposta"
            value={avgResponse ? formatSeconds(avgResponse) : '—'}
            icon={<Clock className="w-4 h-4" />}
            color="sky"
          />
        </div>

        {/* Empty state */}
        {filteredMetrics.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <TrendingUp className="w-10 h-10 opacity-20" />
            <p className="text-sm">Nenhum dado para o período selecionado.</p>
            <p className="text-xs">Os dados são computados pelo worker a cada hora.</p>
          </div>
        )}

        {filteredMetrics.length > 0 && (
          <>
            {/* Revenue chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4">Receita Diária</h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b52ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b52ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f1629', border: '1px solid #1e2540', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v), 'Receita']}
                  />
                  <Area type="monotone" dataKey="receita" stroke="#3b52ff" fill="url(#receitaGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Leads chart */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-4">Leads × Conversões</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f1629', border: '1px solid #1e2540', borderRadius: 8 }} />
                    <Bar dataKey="leads" fill="#6366f1" radius={[3, 3, 0, 0]} name="Leads" />
                    <Bar dataKey="ganhos" fill="#10b981" radius={[3, 3, 0, 0]} name="Ganhos" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue by channel */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-4">Receita por Canal</h2>
                {channelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: '#0f1629', border: '1px solid #1e2540', borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    Sem dados de canal ainda
                  </div>
                )}
              </div>
            </div>

            {/* Campaign revenue table */}
            {campaignRevenue.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-4">Receita por Campanha</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      {['Campanha', 'Receita', 'Conversões', 'Investido', 'ROAS'].map(h => (
                        <th key={h} className="pb-2 text-xs font-medium text-muted-foreground text-right first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {campaignRevenue.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="py-2.5">
                          <p className="font-medium text-foreground">{row.campaign?.name ?? 'Orgânico'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{row.campaign?.platform ?? '—'}</p>
                        </td>
                        <td className="py-2.5 text-right text-emerald-400 font-semibold">{formatCurrency(row.revenue)}</td>
                        <td className="py-2.5 text-right">{row.conversions}</td>
                        <td className="py-2.5 text-right text-muted-foreground">{formatCurrency(row.spend)}</td>
                        <td className="py-2.5 text-right">
                          <span className={row.roas >= 2 ? 'text-emerald-400' : row.roas >= 1 ? 'text-yellow-400' : 'text-red-400'}>
                            {row.roas.toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Agent performance */}
            {agentPerf.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Performance por Atendente</h2>
                  <button
                    onClick={() => setAgentTab(v => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {agentTab ? 'Ocultar' : 'Ver detalhes'}
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      {['Atendente', 'Msgs enviadas', 'Leads fechados', 'Receita'].map(h => (
                        <th key={h} className="pb-2 text-xs font-medium text-muted-foreground text-right first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {agentPerf.map((agent, i) => (
                      <tr key={i}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {String(i + 1)}
                            </div>
                            <span className="text-xs text-muted-foreground">{agent.agent_id.slice(0, 8)}…</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right">{agent.messages_sent}</td>
                        <td className="py-2.5 text-right">{agent.leads_closed}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-semibold">{formatCurrency(agent.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, color }: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'emerald' | 'blue' | 'purple' | 'pink' | 'orange' | 'sky'
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    pink: 'text-pink-400 bg-pink-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
    sky: 'text-sky-400 bg-sky-400/10',
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}min`
  return `${Math.round(s / 3600)}h`
}
