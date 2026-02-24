import { createClient } from '@/lib/supabase/client';
import { logEvent } from '@/lib/actions/events';

export interface Stage {
    id: string;
    name: string;
    order_index: number;
    organization_id: string;
}

export interface Lead {
    id: string;
    contact_name: string;
    contact_phone?: string;
    value: number;
    stage_id: string;
    organization_id: string;
    assigned_to?: string;
    source?: string;
    created_at?: string;
    updated_at?: string;
    origin_id?: string;
}

export interface LeadDetail extends Lead {
    lead_origins?: { name: string } | null;
    deals_history?: {
        id: string;
        old_stage: string;
        new_stage: string;
        moved_at: string;
        moved_by?: string;
        stages_old?: { name: string };
        stages_new?: { name: string };
    }[];
}

export interface NewLeadData {
    contact_name: string;
    contact_phone?: string;
    value?: number;
    stage_id: string;
    userId: string;
}

export async function getStages() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('stages')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) throw error;
    return data as Stage[];
}

export async function getLeads() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .neq('status', 'lost')          // Ocultar leads perdidos do kanban
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Lead[];
}

export async function getLead(leadId: string): Promise<LeadDetail | null> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('leads')
        .select('*, lead_origins(name)')
        .eq('id', leadId)
        .single();

    if (error) return null;

    // Buscar histórico de movimentações
    const { data: history } = await supabase
        .from('deals_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('moved_at', { ascending: false });

    return { ...data, deals_history: history || [] } as LeadDetail;
}

export async function createLead(data: NewLeadData) {
    const supabase = createClient();
    const { data: lead, error } = await supabase
        .from('leads')
        .insert({
            contact_name: data.contact_name,
            contact_phone: data.contact_phone || null,
            value: data.value || 0,
            stage_id: data.stage_id,
            assigned_to: data.userId,
            source: 'Manual',
        })
        .select()
        .single();

    if (error) throw error;
    return lead as Lead;
}

export async function updateLeadValue(leadId: string, value: number) {
    const supabase = createClient();
    const { error } = await supabase
        .from('leads')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', leadId);

    if (error) throw error;
}

export async function updateLeadStage(leadId: string, newStageId: string, oldStageId: string, userId: string) {
    const supabase = createClient();

    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .select('organization_id')
        .single();

    if (leadError) throw leadError;

    if (leadData) {
        await supabase.from('deals_history').insert({
            lead_id: leadId,
            organization_id: leadData.organization_id,
            old_stage: oldStageId,
            new_stage: newStageId,
            moved_by: userId,
        });

        await logEvent({
            organization_id: leadData.organization_id,
            event_name: 'stage_changed',
            entity_type: 'lead',
            entity_id: leadId,
            payload: { old_stage: oldStageId, new_stage: newStageId, moved_by: userId },
        });
    }
}
