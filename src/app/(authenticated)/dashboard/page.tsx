'use client';

import { useEffect, useState } from 'react';
import { getDashboardMetrics, DashboardMetrics } from '@/lib/api/metrics';

export default function DashboardPage() {
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalPipeline: 0,
        totalLeads: 0,
        conversionRate: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadMetrics() {
            const data = await getDashboardMetrics();
            setMetrics(data);
            setLoading(false);
        }
        loadMetrics();
    }, []);

    if (loading) {
        return <div className="p-8 text-gray-500">Loading metrics...</div>;
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
                <p className="text-gray-500">Overview of your performance</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Total Pipeline</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalPipeline)}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Leads Total</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalLeads}</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500 uppercase">Conversão</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                        {metrics.conversionRate.toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>
    );
}
