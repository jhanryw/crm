'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, getServiceSupabase } from '@/lib/auth/server';
import { sendFacebookConversion } from '@/lib/conversions/facebook';

const LOSS_REASONS = [
    'Preço alto',
    'Comprou na concorrência',
    'Sem orçamento no momento',
    'Sem interesse',
    'Não retornou o contato',
    'Mudou de ideia',
    'Outros',
] as const;
export type LossReason = typeof LOSS_REASONS[number];

export async function markLeadAsLost(
    leadId: string,
    reason: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        const { orgId } = await requireAuth();
        const supabase = getServiceSupabase();

        const { error } = await supabase
            .from('leads')
            .update({
                status: 'lost',
                lost_reason: reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', leadId)
            .eq('organization_id', orgId);

        if (error) throw error;

        // Log the event
        const { data: lead } = await supabase
            .from('leads')
            .select('organization_id')
            .eq('id', leadId)
            .single();

        if (lead) {
            try {
                await supabase.from('event_log').insert({
                    organization_id: lead.organization_id,
                    event_name: 'lead_lost',
                    entity_type: 'lead',
                    entity_id: leadId,
                    payload: { reason },
                });
            } catch { /* log não é crítico */ }
        }

        revalidatePath('/kanban');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao marcar como perdido.' };
    }
}

export async function updateLeadStageWithSale(
    leadId: string,
    newStageId: string,
    oldStageId: string,
    userId: string,
    dealValue: number
): Promise<{ success: true; facebookSent: boolean } | { success: false; error: string }> {
    try {
        const { orgId } = await requireAuth();
        const supabase = getServiceSupabase();

        // Update lead
        const { error: leadErr } = await supabase
            .from('leads')
            .update({
                stage_id: newStageId,
                value: dealValue,
                status: 'won',
                updated_at: new Date().toISOString(),
            })
            .eq('id', leadId)
            .eq('organization_id', orgId);

        if (leadErr) throw leadErr;

        // Record history
        await supabase.from('deals_history').insert({
            lead_id: leadId,
            organization_id: orgId,
            old_stage: oldStageId,
            new_stage: newStageId,
            moved_by: userId,
        });

        // Log event
        try {
            await supabase.from('event_log').insert({
                organization_id: orgId,
                event_name: 'sale_closed',
                entity_type: 'lead',
                entity_id: leadId,
                payload: { value: dealValue, stage_id: newStageId },
            });
        } catch { /* log não é crítico */ }

        // Facebook Pixel CAPI
        let facebookSent = false;
        try {
            const { data: pixelIntegration } = await supabase
                .from('integrations')
                .select('config')
                .eq('organization_id', orgId)
                .eq('channel', 'facebook_pixel')
                .maybeSingle();

            if (pixelIntegration?.config?.pixelId && pixelIntegration?.config?.accessToken) {
                // Fetch lead phone for hashing
                const { data: lead } = await supabase
                    .from('leads')
                    .select('contact_phone')
                    .eq('id', leadId)
                    .single();

                const result = await sendFacebookConversion({
                    pixelId: pixelIntegration.config.pixelId,
                    accessToken: pixelIntegration.config.accessToken,
                    testEventCode: pixelIntegration.config.testEventCode || null,
                    leadId,
                    value: dealValue,
                    phone: lead?.contact_phone || null,
                });
                facebookSent = result.success;
                if (!result.success) {
                    console.warn('[FB CAPI] Falha ao enviar evento:', result.error);
                }
            }
        } catch (fbErr: any) {
            console.warn('[FB CAPI] Erro:', fbErr?.message);
        }

        revalidatePath('/kanban');
        return { success: true, facebookSent };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao registrar venda.' };
    }
}
