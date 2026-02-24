import { getDashboardMetrics } from '@/app/actions/metrics';
import { TrendingUp, Users, BarChart2, MessageSquare } from 'lucide-react';

const BRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface MetricCardProps {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
}

function MetricCard({ label, value, sub, icon: Icon, iconBg, iconColor }: MetricCardProps) {
    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: iconBg }}
                >
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
            </div>
            <div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
                {sub && (
                    <p className="text-xs text-gray-400 mt-1">{sub}</p>
                )}
            </div>
        </div>
    );
}

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics();
    const maxCount = Math.max(...metrics.leadsBySource.map(s => s.count), 1);

    return (
        <div className="space-y-8 max-w-6xl">
            {/* Saudação */}
            <header>
                <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-500 text-sm mt-1">Visão geral do seu pipeline e performance</p>
            </header>

            {/* Cards de métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                    label="Pipeline Total"
                    value={BRL(metrics.totalPipeline)}
                    sub="Valor em aberto"
                    icon={TrendingUp}
                    iconBg="#e8faf7"
                    iconColor="#1fc2a9"
                />
                <MetricCard
                    label="Leads Totais"
                    value={String(metrics.totalLeads)}
                    sub="Todos os estágios"
                    icon={Users}
                    iconBg="#f0f0ff"
                    iconColor="#6366f1"
                />
                <MetricCard
                    label="Taxa de Conversão"
                    value={`${metrics.conversionRate.toFixed(1)}%`}
                    sub="Ganhos / (Ganhos + Perdidos)"
                    icon={BarChart2}
                    iconBg="#fff7ed"
                    iconColor="#f97316"
                />
                <MetricCard
                    label="Conversas Pendentes"
                    value={String(metrics.pendingConversations)}
                    sub="Aguardando aprovação"
                    icon={MessageSquare}
                    iconBg="#fdf2f8"
                    iconColor="#ec4899"
                />
            </div>

            {/* Leads por canal */}
            {metrics.leadsBySource.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800 text-base">Leads por Origem</h3>
                        <span className="text-xs text-gray-400">{metrics.totalLeads} total</span>
                    </div>
                    <div className="space-y-4">
                        {metrics.leadsBySource
                            .sort((a, b) => b.count - a.count)
                            .map(({ source, count }) => {
                                const pct = (count / maxCount) * 100;
                                const isWA = source.toLowerCase().includes('whatsapp');
                                const isIG = source.toLowerCase().includes('instagram');
                                const barColor = isWA ? '#1fc2a9' : isIG ? '#ec4899' : '#6366f1';
                                return (
                                    <div key={source}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium text-gray-700 truncate">{source}</span>
                                            <span className="text-sm font-bold text-gray-900 ml-4 flex-shrink-0">{count}</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, background: barColor }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Estado vazio */}
            {metrics.totalLeads === 0 && (
                <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: '#e8faf7' }}
                    >
                        <TrendingUp size={28} style={{ color: '#1fc2a9' }} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">Nenhum dado ainda</h3>
                    <p className="text-gray-500 text-sm">Conecte seu WhatsApp e comece a receber leads no pipeline.</p>
                </div>
            )}
        </div>
    );
}
