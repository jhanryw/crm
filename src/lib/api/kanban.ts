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
    value: number;
    stage_id: string;
    organization_id: string;
    assigned_to?: string;
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
        .select('*');

    if (error) throw error;
    return data as Lead[];
}

export async function updateLeadStage(leadId: string, newStageId: string, oldStageId: string, userId: string) {
    const supabase = createClient();

    // 1. Update Lead
    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .select('organization_id')
        .single();

    if (leadError) throw leadError;

    // 2. Insert History (Assuming successful lead update)
    if (leadData) {
        const { error: historyError } = await supabase
            .from('deals_history')
            .insert({
                lead_id: leadId,
                organization_id: leadData.organization_id,
                old_stage: oldStageId,
                new_stage: newStageId,
                moved_by: userId
            });

        if (historyError) {
            console.error("Failed to log history:", historyError);
        }
    }

    // 3. Trigger internal event
    if (leadData) {
        // Use Server Action to log event (safe for Client usage)
        await logEvent({
            organization_id: leadData.organization_id,
            event_name: 'stage_changed',
            entity_type: 'lead',
            entity_id: leadId,
            payload: { old_stage: oldStageId, new_stage: newStageId, moved_by: userId }
        });
    }
}
