'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, getServiceSupabase } from '@/lib/auth/server';

export async function getIntegrations() {
    const { orgId } = await requireAuth();
    const { data } = await getServiceSupabase().from('integrations').select('*').eq('organization_id', orgId);
    return data || [];
}

/** Force-sync WhatsApp connection state from Evolution API → Supabase */
export async function syncWhatsAppStatus(): Promise<
    { success: true; status: string } |
    { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const evolutionUrl = process.env.EVOLUTION_API_URL || '';
        const evolutionKey = process.env.EVOLUTION_API_KEY || '';
        if (!evolutionUrl || !evolutionKey) return { success: false, error: 'Evolution API não configurada.' };

        const instanceName = `qarvon-${orgId.slice(0, 8)}`;
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;

        // Re-register webhook (idempotent) — try both flat and nested format for compatibility
        const webhookBody = {
            webhook: {
                url: webhookUrl,
                enabled: true,
                webhookByEvents: false,
                webhookBase64: false,
                events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
            },
        };
        const webhookRes = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookBody),
        }).catch(() => null);
        console.log('[syncWA] webhook/set status:', webhookRes?.status);

        // Check real connection state from Evolution API
        const stateRes = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': evolutionKey },
        }).catch(() => null);

        if (!stateRes?.ok) {
            return { success: false, error: `Evolution API não respondeu (${stateRes?.status ?? 'sem resposta'})` };
        }

        const stateData = await stateRes.json();
        console.log('[syncWA] connectionState response:', JSON.stringify(stateData));

        // Evolution API v1: { instance: { state: 'open' } }
        // Evolution API v2: { state: 'open' } or { instance: { connectionStatus: 'open' } }
        const rawState: string = (
            stateData?.instance?.state ||
            stateData?.instance?.connectionStatus ||
            stateData?.state ||
            stateData?.connectionStatus ||
            ''
        ).toLowerCase();

        const newStatus = rawState === 'open' ? 'connected'
            : rawState === 'close' || rawState === 'closed' ? 'disconnected'
                : 'connecting';

        await getServiceSupabase()
            .from('integrations')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp');

        revalidatePath('/settings');
        return { success: true, status: newStatus };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao sincronizar.' };
    }
}

export async function connectWhatsApp(): Promise<
    { success: true; qrBase64: string | null; alreadyConnected?: boolean; [key: string]: any } |
    { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão para configurar integrações.' };

        const evolutionUrl = process.env.EVOLUTION_API_URL || '';
        const evolutionKey = process.env.EVOLUTION_API_KEY || '';

        if (!evolutionUrl || !evolutionKey) {
            return { success: false, error: 'Evolution API não configurada. Adicione EVOLUTION_API_URL e EVOLUTION_API_KEY no EasyPanel.' };
        }

        const instanceName = `qarvon-${orgId.slice(0, 8)}`;
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;
        const webhookEvents = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

        // 1. Create instance (silently fails if already exists)
        await fetch(`${evolutionUrl}/instance/create`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instanceName,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS',
                webhook: { url: webhookUrl, enabled: true, webhookByEvents: false, webhookBase64: false, events: webhookEvents },
            }),
        }).catch(() => null);

        // 2. Re-set webhook — try nested format first (Evolution API v2), then flat (v1)
        const whSetRes = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhook: { url: webhookUrl, enabled: true, webhookByEvents: false, webhookBase64: false, events: webhookEvents },
            }),
        }).catch(() => null);
        console.log('[connectWA] webhook/set status:', whSetRes?.status);

        // 3. Check if already connected — if so, skip QR entirely
        const stateRes = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': evolutionKey },
        }).catch(() => null);

        if (stateRes?.ok) {
            const stateData = await stateRes.json();
            const rawState: string = (
                stateData?.instance?.state ||
                stateData?.instance?.connectionStatus ||
                stateData?.state ||
                stateData?.connectionStatus || ''
            ).toLowerCase();
            console.log('[connectWA] connectionState:', rawState);

            if (rawState === 'open') {
                // Already connected — update DB and return immediately
                const { data, error } = await getServiceSupabase()
                    .from('integrations')
                    .upsert(
                        { organization_id: orgId, channel: 'whatsapp', status: 'connected', config: { instanceName } },
                        { onConflict: 'organization_id, channel' }
                    )
                    .select()
                    .single();

                if (error) return { success: false, error: `Erro ao salvar integração: ${error.message}` };
                revalidatePath('/settings');
                return { success: true, ...data, qrBase64: null, alreadyConnected: true };
            }
        }

        // 4. Not connected — get QR code
        const qrRes = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
            headers: { 'apikey': evolutionKey },
        });

        if (!qrRes.ok) {
            return { success: false, error: `Evolution API erro ${qrRes.status}. Verifique se a URL e a chave estão corretas.` };
        }

        const qrData = await qrRes.json();
        // Evolution API sometimes returns a full data URI — strip prefix so we store raw base64 only
        let rawQr: string | null = qrData.base64 || qrData.qrcode?.base64 || qrData.code || null;
        if (rawQr?.startsWith('data:')) rawQr = rawQr.split(',')[1] ?? null;
        const qrBase64 = rawQr;

        const { data, error } = await getServiceSupabase()
            .from('integrations')
            .upsert(
                { organization_id: orgId, channel: 'whatsapp', status: 'connecting', config: { instanceName, qrCode: qrBase64 } },
                { onConflict: 'organization_id, channel' }
            )
            .select()
            .single();

        if (error) return { success: false, error: `Erro ao salvar integração: ${error.message}` };

        revalidatePath('/settings');
        return { success: true, ...data, qrBase64 };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro inesperado ao conectar WhatsApp.' };
    }
}

// Instagram connection is now handled via Meta OAuth routes:
// GET /api/auth/instagram/connect  → redirects to Meta/Facebook login
// GET /api/auth/instagram/callback → exchanges code, saves token

// ORIGINS
export async function getOrigins() {
    const { orgId } = await requireAuth();
    const { data } = await getServiceSupabase()
        .from('lead_origins')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });
    return data || [];
}

export async function addOrigin(name: string, regex: string): Promise<
    { success: true } | { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão para adicionar origens.' };

        const { error } = await getServiceSupabase()
            .from('lead_origins')
            .insert({ organization_id: orgId, name, auto_match_regex: regex || null });

        if (error) return { success: false, error: error.message };

        revalidatePath('/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao adicionar origem.' };
    }
}

export async function deleteOrigin(id: string): Promise<
    { success: true } | { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão para excluir origens.' };

        const { error } = await getServiceSupabase()
            .from('lead_origins')
            .delete()
            .eq('id', id)
            .eq('organization_id', orgId);

        if (error) return { success: false, error: error.message };

        revalidatePath('/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao excluir origem.' };
    }
}
