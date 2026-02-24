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

export async function connectWhatsApp(name: string = 'Principal'): Promise<
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

        // Create unique instance name: qarvon-${orgId}-${name}
        const baseName = name.toLowerCase().replace(/\s+/g, '-');
        const instanceName = `qarvon-${orgId.slice(0, 8)}-${baseName}`;
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
                        { organization_id: orgId, channel: 'whatsapp', name, status: 'connected', config: { instanceName } },
                        { onConflict: 'organization_id, channel, name' }
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
                { organization_id: orgId, channel: 'whatsapp', name, status: 'connecting', config: { instanceName, qrCode: qrBase64 } },
                { onConflict: 'organization_id, channel, name' }
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
 * @param whatsappInstanceId - Optional: specific instance to import from. If not provided, uses first instance.
 */
export async function importWhatsAppChats(whatsappInstanceId?: string): Promise<
    { success: true; imported: number; skipped: number; errors: number } |
    { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const evolutionUrl = process.env.EVOLUTION_API_URL || '';
        const evolutionKey = process.env.EVOLUTION_API_KEY || '';
        if (!evolutionUrl || !evolutionKey) return { success: false, error: 'Evolution API não configurada.' };

        const supabase = getServiceSupabase();

        // Get the WhatsApp instance to import from
        let integration: any;
        if (whatsappInstanceId) {
            const { data } = await supabase
                .from('integrations')
                .select('id, config')
                .eq('id', whatsappInstanceId)
                .eq('organization_id', orgId)
                .eq('channel', 'whatsapp')
                .single();
            integration = data;
        } else {
            // If not specified, use first connected instance (or any if none connected)
            const { data } = await supabase
                .from('integrations')
                .select('id, config')
                .eq('organization_id', orgId)
                .eq('channel', 'whatsapp')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            integration = data;
        }

        if (!integration) {
            return { success: false, error: 'Nenhuma instância WhatsApp encontrada.' };
        }

        const instanceName = integration.config?.instanceName;
        if (!instanceName) {
            return { success: false, error: 'instanceName não encontrado na integração.' };
        }

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
            // Evolution API v2 usa remoteJid; chat.id pode ser um hash interno
            const remoteJid: string = chat.remoteJid || chat.id || '';

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
                        whatsapp_instance_id: integration.id,
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

// ── STAGE MANAGEMENT ──────────────────────────────────────────────────────────

const DEFAULT_STAGES = [
    { name: 'Novo Lead', order_index: 0 },
    { name: 'Em Negociação', order_index: 1 },
    { name: 'Venda realizada', order_index: 2 },
];

export async function getStages() {
    const { orgId } = await requireAuth();
    const supabase = getServiceSupabase();

    let { data: stages } = await supabase
        .from('stages')
        .select('*')
        .eq('organization_id', orgId)
        .order('order_index', { ascending: true });

    // Auto-create default stages if none exist
    if (!stages || stages.length === 0) {
        const toInsert = DEFAULT_STAGES.map(s => ({ ...s, organization_id: orgId }));
        const { data: created } = await supabase
            .from('stages')
            .insert(toInsert)
            .select();
        stages = created || [];
        revalidatePath('/settings');
        revalidatePath('/kanban');
    }

    return stages || [];
}

export async function createStage(name: string): Promise<
    { success: true; stage: any } | { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const supabase = getServiceSupabase();

        // Get max order_index
        const { data: existing } = await supabase
            .from('stages')
            .select('order_index')
            .eq('organization_id', orgId)
            .order('order_index', { ascending: false })
            .limit(1);

        const nextIndex = (existing?.[0]?.order_index ?? -1) + 1;

        const { data: stage, error } = await supabase
            .from('stages')
            .insert({ organization_id: orgId, name: name.trim(), order_index: nextIndex })
            .select()
            .single();

        if (error) return { success: false, error: error.message };

        revalidatePath('/settings');
        revalidatePath('/kanban');
        return { success: true, stage };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao criar estágio.' };
    }
}

export async function deleteStage(id: string): Promise<
    { success: true } | { success: false; error: string }
> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const supabase = getServiceSupabase();

        // Check if stage has leads
        const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('stage_id', id)
            .eq('organization_id', orgId)
            .neq('status', 'lost');

        if (count && count > 0) {
            return {
                success: false,
                error: `Este estágio possui ${count} lead${count > 1 ? 's' : ''}. Mova-os primeiro.`,
            };
        }

        const { error } = await supabase
            .from('stages')
            .delete()
            .eq('id', id)
            .eq('organization_id', orgId);

        if (error) return { success: false, error: error.message };

        revalidatePath('/settings');
        revalidatePath('/kanban');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao excluir estágio.' };
    }
}

// ── FACEBOOK PIXEL CONFIG ─────────────────────────────────────────────────────

export async function getFacebookPixelConfig() {
    const { orgId } = await requireAuth();
    const { data } = await getServiceSupabase()
        .from('integrations')
        .select('config')
        .eq('organization_id', orgId)
        .eq('channel', 'facebook_pixel')
        .maybeSingle();
    return data?.config || null;
}

export async function saveFacebookPixelConfig(
    pixelId: string,
    accessToken: string,
    testEventCode: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const config = {
            pixelId: pixelId.trim(),
            accessToken: accessToken.trim(),
            testEventCode: testEventCode.trim() || null,
        };

        const { error } = await getServiceSupabase()
            .from('integrations')
            .upsert(
                { organization_id: orgId, channel: 'facebook_pixel', status: 'connected', config },
                { onConflict: 'organization_id,channel' }
            );

        if (error) return { success: false, error: error.message };

        revalidatePath('/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao salvar configuração.' };
    }
}

export async function testFacebookPixelEvent(): Promise<
    { success: boolean; message: string; rawResponse?: any }
> {
    try {
        const { orgId } = await requireAuth();
        const { data } = await getServiceSupabase()
            .from('integrations')
            .select('config')
            .eq('organization_id', orgId)
            .eq('channel', 'facebook_pixel')
            .maybeSingle();

        if (!data?.config?.pixelId || !data?.config?.accessToken) {
            return { success: false, message: 'Configure o Pixel ID e Access Token primeiro.' };
        }

        const { sendFacebookConversion } = await import('@/lib/conversions/facebook');
        const result = await sendFacebookConversion({
            pixelId: data.config.pixelId,
            accessToken: data.config.accessToken,
            testEventCode: data.config.testEventCode || undefined,
            leadId: `test-${Date.now()}`,
            value: 1,
            currency: 'BRL',
        });

        if (result.success) {
            return {
                success: true,
                message: `✅ Evento enviado com sucesso! (${result.eventsReceived ?? 1} recebido pelo Meta)`,
                rawResponse: result.rawResponse,
            };
        } else {
            return {
                success: false,
                message: `❌ Erro: ${result.error}`,
                rawResponse: result.rawResponse,
            };
        }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Erro inesperado.' };
    }
}

/**
 * Get all WhatsApp instances for the organization
 */
export async function getWhatsAppInstances() {
    const { orgId } = await requireAuth();
    const supabase = getServiceSupabase();

    const { data } = await supabase
        .from('integrations')
        .select('id, name, status, config, created_at')
        .eq('organization_id', orgId)
        .eq('channel', 'whatsapp')
        .order('created_at', { ascending: true });

    return data || [];
}

/**
 * Disconnect and delete a WhatsApp instance
 * Calls Evolution API to clean up the backend instance
 */
export async function disconnectWhatsApp(instanceId: string) {
    try {
        const { orgId, role } = await requireAuth();
        if (role === 'salesperson') return { success: false, error: 'Sem permissão.' };

        const supabase = getServiceSupabase();

        // Get instance details
        const { data: integration, error: fetchErr } = await supabase
            .from('integrations')
            .select('config, name')
            .eq('id', instanceId)
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp')
            .single();

        if (fetchErr || !integration) {
            return { success: false, error: 'WhatsApp não encontrado.' };
        }

        const instanceName = integration.config?.instanceName;
        if (!instanceName) {
            return { success: false, error: 'instanceName não encontrado na configuração.' };
        }

        // Try to delete from Evolution API (don't fail if it errors)
        const evolutionUrl = process.env.EVOLUTION_API_URL || '';
        const evolutionKey = process.env.EVOLUTION_API_KEY || '';

        if (evolutionUrl && evolutionKey) {
            try {
                await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
                    method: 'DELETE',
                    headers: { 'apikey': evolutionKey },
                }).catch(() => null);
            } catch (err) {
                console.warn('[disconnectWA] Evolution API error:', err);
            }
        }

        // Delete from database
        const { error: deleteErr } = await supabase
            .from('integrations')
            .delete()
            .eq('id', instanceId)
            .eq('organization_id', orgId);

        if (deleteErr) {
            return { success: false, error: `Erro ao deletar: ${deleteErr.message}` };
        }

        revalidatePath('/settings');
        revalidatePath('/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Erro ao desconectar WhatsApp.' };
    }
}
