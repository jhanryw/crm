import { getDashboardMetrics } from '@/app/actions/metrics';

const BRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics();

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
                <p className="text-gray-500 text-sm">Visão geral do seu pipeline e performance</p>
            </header>

            {/* Cards principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                    label="Pipeline Total"
                    value={BRL(metrics.totalPipeline)}
                    sub="Leads ativos"
                />
                <MetricCard
                    label="Leads Totais"
                    value={String(metrics.totalLeads)}
                    sub="Todos os estágios"
                />
                <MetricCard
                    label="Taxa de Conversão"
                    value={`${metrics.conversionRate.toFixed(1)}%`}
                    sub="Ganhos / (Ganhos + Perdidos)"
                />
                <MetricCard
                    label="Conversas Pendentes"
                    value={String(metrics.pendingConversations)}
                    sub="Aguardando aprovação"
                />
            </div>

            {/* Leads por canal */}
            {metrics.leadsBySource.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Leads por Canal</h3>
                    <div className="space-y-3">
                        {metrics.leadsBySource
                            .sort((a, b) => b.count - a.count)
                            .map(({ source, count }) => {
                                const pct = metrics.totalLeads > 0 ? (count / metrics.totalLeads) * 100 : 0;
                                const isWA = source.toLowerCase().includes('whatsapp');
                                const isIG = source.toLowerCase().includes('instagram');
                                const color = isWA ? 'bg-green-500' : isIG ? 'bg-pink-500' : 'bg-blue-500';
                                return (
                                    <div key={source} className="flex items-center gap-3">
                                        <span className="text-sm text-gray-600 w-28 truncate">{source}</span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
