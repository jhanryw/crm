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
                events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
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
        const webhookEvents = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

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

/**
 * Importa TODOS os chats existentes do WhatsApp para o CRM.
 * Usa Evolution API /chat/findChats + /chat/findMessages.
 * Cria conversas + mensagens históricas no banco.
 */
export async function importWhatsAppChats(): Promise<
    { success: true; imported: number; skipped: number; errors: number } |
    { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const evolutionUrl = process.env.EVOLUTION_API_URL || '';
        const evolutionKey = process.env.EVOLUTION_API_KEY || '';
        if (!evolutionUrl || !evolutionKey) return { success: false, error: 'Evolution API não configurada.' };

        const instanceName = `qarvon-${orgId.slice(0, 8)}`;
        const supabase = getServiceSupabase();

        // ── 1. Buscar todos os chats na Evolution API ─────────────────────────
        const chatsRes = await fetch(`${evolutionUrl}/chat/findChats/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }).catch(() => null);

        if (!chatsRes?.ok) {
            const status = chatsRes?.status ?? 'sem resposta';
            return { success: false, error: `Evolution API erro ${status} ao buscar chats. Verifique se a instância está conectada.` };
        }

        const chatsRaw = await chatsRes.json();
        // Evolution API pode retornar array direto ou { chats: [] } ou { data: [] }
        const chats: any[] = Array.isArray(chatsRaw)
            ? chatsRaw
            : (chatsRaw?.chats || chatsRaw?.data || []);

        if (!chats.length) {
            return { success: true, imported: 0, skipped: 0, errors: 0 };
        }

        // ── 2. Buscar conversas já existentes para evitar duplicatas ──────────
        const { data: existingConvs } = await supabase
            .from('inbox_conversations')
            .select('contact_id')
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp');

        const existingContacts = new Set((existingConvs || []).map((c: any) => c.contact_id));

        // ── 3. Buscar origens para match por regex ────────────────────────────
        const { data: origins } = await supabase
            .from('lead_origins')
            .select('id, name, auto_match_regex')
            .eq('organization_id', orgId);

        let imported = 0, skipped = 0, errors = 0;

        for (const chat of chats) {
            // remoteJid pode estar em chat.id ou chat.remoteJid
            const remoteJid: string = chat.id || chat.remoteJid || '';

            // Pular grupos, broadcast e listas
            if (!remoteJid
                || remoteJid.includes('@g.us')
                || remoteJid.includes('@broadcast')
                || remoteJid.includes('status@broadcast')) {
                skipped++;
                continue;
            }

            const phone = remoteJid.split('@')[0].split(':')[0];

            // Já existe → pular
            if (existingContacts.has(phone)) {
                skipped++;
                continue;
            }

            // ── 4. Buscar mensagens desse chat ────────────────────────────────
            let msgs: any[] = [];
            try {
                const msgsRes = await fetch(`${evolutionUrl}/chat/findMessages/${instanceName}`, {
                    method: 'POST',
                    headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        where: { key: { remoteJid } },
                        limit: 50,
                    }),
                }).catch(() => null);

                if (msgsRes?.ok) {
                    const msgsRaw = await msgsRes.json();
                    msgs = Array.isArray(msgsRaw)
                        ? msgsRaw
                        : (msgsRaw?.messages?.records || msgsRaw?.messages || msgsRaw?.data || []);
                }
            } catch { /* ignora falhas individuais */ }

            // ── 5. Match de origem pelo texto da primeira mensagem recebida ───
            let originId: string | null = null;
            const firstIncoming = msgs.find((m: any) => !m.key?.fromMe);
            const firstText = firstIncoming?.message?.conversation
                || firstIncoming?.message?.extendedTextMessage?.text
                || '';

            if (origins?.length && firstText) {
                for (const origin of origins) {
                    if (origin.auto_match_regex?.trim()) {
                        try {
                            if (new RegExp(origin.auto_match_regex, 'i').test(firstText)) {
                                originId = origin.id;
                                break;
                            }
                        } catch { /* regex inválida */ }
                    }
                }
            }
            // Fallback: origem "WhatsApp Orgânico"
            if (!originId && origins?.length) {
                const organic = origins.find((o: any) => o.name === 'WhatsApp Orgânico');
                if (organic) originId = organic.id;
            }

            // ── 6. Criar conversa ─────────────────────────────────────────────
            try {
                const { data: newConv, error: convErr } = await supabase
                    .from('inbox_conversations')
                    .insert({
                        organization_id: orgId,
                        channel: 'whatsapp',
                        contact_id: phone,
                        status: 'pending',
                        origin_id: originId,
                    })
                    .select('id')
                    .single();

                if (convErr || !newConv) { errors++; continue; }

                // ── 7. Inserir mensagens históricas ───────────────────────────
                if (msgs.length > 0) {
                    const toInsert = msgs
                        .map((m: any) => {
                            const body = m.message?.conversation
                                || m.message?.extendedTextMessage?.text
                                || m.message?.imageMessage?.caption
                                || '';
                            if (!body) return null;
                            return {
                                organization_id: orgId,
                                conversation_id: newConv.id,
                                direction: m.key?.fromMe ? 'out' : 'in',
                                body,
                                created_at: m.messageTimestamp
                                    ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
                                    : new Date().toISOString(),
                            };
                        })
                        .filter(Boolean);

                    if (toInsert.length > 0) {
                        await supabase.from('messages').insert(toInsert);
                    }
                }

                existingContacts.add(phone);
                imported++;
            } catch { errors++; }
        }

        revalidatePath('/settings');
        revalidatePath('/inbox');
        return { success: true, imported, skipped, errors };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao importar conversas.' };
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
