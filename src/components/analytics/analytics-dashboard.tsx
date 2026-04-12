'use client'

import { DailyMetrics } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, Users, MessageSquare, ShoppingBag } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

const COLORS = ['#3b52ff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

export function AnalyticsDashboard({ metrics, campaignRevenue }: AnalyticsDashboardProps) {
  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0)
  const totalLeads = metrics.reduce((s, m) => s + m.new_leads, 0)
  const totalWon = metrics.reduce((s, m) => s + m.leads_won, 0)
  const totalConvos = metrics.reduce((s, m) => s + m.conversations_started, 0)

  const chartData = metrics.map(m => ({
    date: format(parseISO(m.date), 'dd/MM', { locale: ptBR }),
    receita: m.revenue,
    leads: m.new_leads,
    ganhos: m.leads_won,
  }))

  const channelData = metrics.length > 0
    ? Object.entries(
        metrics.reduce((acc, m) => {
          Object.entries(m.revenue_by_channel).forEach(([k, v]) => {
            acc[k] = (acc[k] ?? 0) + (v as number)
          })
          return acc
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Receita Total"
            value={formatCurrency(totalRevenue)}
            icon={<ShoppingBag className="w-4 h-4" />}
            color="emerald"
          />
          <KPICard
            label="Novos Leads"
            value={totalLeads.toString()}
            icon={<Users className="w-4 h-4" />}
            color="blue"
          />
          <KPICard
            label="Conversões"
            value={totalWon.toString()}
            icon={<TrendingUp className="w-4 h-4" />}
            color="purple"
          />
          <KPICard
            label="Conversas"
            value={totalConvos.toString()}
            icon={<MessageSquare className="w-4 h-4" />}
            color="pink"
          />
        </div>

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
                    {channelData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
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
                  <th className="pb-2 text-xs font-medium text-muted-foreground">Campanha</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Receita</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Conversões</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Investido</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">ROAS</th>
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
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, color }: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'emerald' | 'blue' | 'purple' | 'pink'
}) {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    pink: 'text-pink-400 bg-pink-400/10',
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
