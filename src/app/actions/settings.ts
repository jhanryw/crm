'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, getServiceSupabase } from '@/lib/auth/server';

export async function getIntegrations() {
    const { orgId } = await requireAuth();
    const { data } = await getServiceSupabase().from('integrations').select('*').eq('organization_id', orgId);
    return data || [];
}

export async function connectWhatsApp(): Promise<
    { success: true; qrBase64: string | null; [key: string]: any } |
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

        await fetch(`${evolutionUrl}/instance/create`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
        }).catch(() => null);

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
