'use server';

import { createClient } from '@supabase/supabase-js';
import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase env vars not configured');
    return createClient(url, key);
}

async function getOrgId(): Promise<string | null> {
    try {
        const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
        if (!isAuthenticated || !claims?.sub) return null;

        const { data: user } = await getSupabase()
            .from('users')
            .select('organization_id')
            .eq('logto_id', claims.sub)
            .single();

        return user?.organization_id || null;
    } catch {
        return null;
    }
}

const EMPTY_METRICS = { totalPipeline: 0, totalLeads: 0, conversionRate: 0, pendingConversations: 0, leadsBySource: [] };

export async function getDashboardMetrics() {
    try {
        const orgId = await getOrgId();
        if (!orgId) return EMPTY_METRICS;

        const supabase = getSupabase();

        const [leadsRes, convRes] = await Promise.all([
            supabase.from('leads').select('value, stage_id, source, stages(name)').eq('organization_id', orgId),
            supabase.from('inbox_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
        ]);

        const allLeads = leadsRes.data || [];
        const totalLeads = allLeads.length;

        const getStageName = (lead: any) => {
            const stage = lead.stages;
            if (Array.isArray(stage)) return stage[0]?.name;
            return stage?.name;
        };

        const activeLeads = allLeads.filter(l => {
            const name = getStageName(l);
            return name !== 'Fechado Ganho' && name !== 'Fechado Perdido' && name !== 'Closed Won' && name !== 'Closed Lost';
        });

        const totalPipeline = activeLeads.reduce((sum, l) => sum + (l.value || 0), 0);

        const wonLeads = allLeads.filter(l => ['Fechado Ganho', 'Closed Won'].includes(getStageName(l) || '')).length;
        const lostLeads = allLeads.filter(l => ['Fechado Perdido', 'Closed Lost'].includes(getStageName(l) || '')).length;
        const closedTotal = wonLeads + lostLeads;
        const conversionRate = closedTotal > 0 ? (wonLeads / closedTotal) * 100 : 0;

        const sourceMap: Record<string, number> = {};
        for (const lead of allLeads) {
            const src = lead.source || 'Outro';
            sourceMap[src] = (sourceMap[src] || 0) + 1;
        }
        const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));

        return { totalPipeline, totalLeads, conversionRate, pendingConversations: convRes.count || 0, leadsBySource };
    } catch (err) {
        console.error('[getDashboardMetrics]', err);
        return EMPTY_METRICS;
    }
}
