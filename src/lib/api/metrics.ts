import { createClient } from '@/lib/supabase/client';

export interface DashboardMetrics {
    totalPipeline: number;
    totalLeads: number;
    conversionRate: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const supabase = createClient();

    // 1. Total Pipeline Value (Sum of value of all open leads)
    // We assume 'Closed Won' and 'Closed Lost' are terminal states.
    // Ideally we query stages via name, but for speed we might fetch all leads.
    // Best practice: efficient query.

    // Fetch non-closed stages first or just fetch all leads and filter in memory if small scale.
    // For production, this should be a DB view or RPC.
    const { data: leads, error } = await supabase
        .from('leads')
        .select('value, stage_id, stages(name)');

    if (error) {
        console.error("Error fetching metrics:", error);
        return { totalPipeline: 0, totalLeads: 0, conversionRate: 0 };
    }

    const allLeads = leads || [];
    const totalLeads = allLeads.length;

    // Helper to extract stage name safely (handle Supabase returning array or object)
    const getStageName = (lead: any) => {
        const stage = lead.stages;
        if (Array.isArray(stage)) return stage[0]?.name;
        return stage?.name;
    };

    const activeLeads = allLeads.filter(l => {
        const name = getStageName(l);
        return name !== 'Closed Won' && name !== 'Closed Lost';
    });

    const totalPipeline = activeLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

    // Conversion: Won / (Won + Lost)
    const wonLeads = allLeads.filter(l => getStageName(l) === 'Closed Won').length;
    const lostLeads = allLeads.filter(l => getStageName(l) === 'Closed Lost').length;
    const closedTotal = wonLeads + lostLeads;

    const conversionRate = closedTotal > 0 ? (wonLeads / closedTotal) * 100 : 0;

    return {
        totalPipeline,
        totalLeads,
        conversionRate
    };
}
