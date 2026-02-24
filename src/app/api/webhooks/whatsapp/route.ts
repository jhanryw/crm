import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET() {
    return NextResponse.json({ status: 'ok' });
}

export async function POST(request: NextRequest) {
    const supabase = getSupabase();
    try {
        const body = await request.json();

        const event: string = (body.event || body.type || '').toLowerCase().replace(/_/g, '.');
        const instanceName: string = body.instance || body.instanceName || body.instanceId || '';

        console.log('[WA webhook]', event, instanceName);

        // ── Conexão ───────────────────────────────────────────────────────────
        if (event === 'connection.update') {
            const state: string = (body.data?.state || '').toLowerCase();
            if (instanceName && state === 'open') {
                await supabase.from('integrations')
                    .update({ status: 'connected', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
                console.log('[WA] → connected', instanceName);
            } else if (instanceName && (state === 'close' || state === 'closed')) {
                await supabase.from('integrations')
                    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
            }
            return NextResponse.json({ ok: true });
        }

        // ── QR code ───────────────────────────────────────────────────────────
        if (event === 'qrcode.updated') {
            const base64: string | null = body.data?.qrcode?.base64 || body.data?.base64 || null;
            if (instanceName && base64) {
                await supabase.from('integrations')
                    .update({ status: 'connecting', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
            }
            return NextResponse.json({ ok: true });
        }

        // ── SEND_MESSAGE — mensagem enviada via Evolution API (pelo CRM ou app) ─
        // Apenas atualiza o updated_at da conversa para subir na lista.
        // Não cria nova mensagem pois o CRM já gravou ao enviar.
        if (event === 'send.message' || event === 'message.send') {
            const remoteJid: string = body.data?.key?.remoteJid || '';
            if (!remoteJid || !instanceName) return NextResponse.json({ ok: true });

            const phone = remoteJid.split('@')[0].split(':')[0];

            // Encontrar org pela instância
            const { data: integrations } = await supabase
                .from('integrations')
                .select('organization_id')
                .eq('channel', 'whatsapp')
                .filter('config->>instanceName', 'eq', instanceName);

            const orgId = integrations?.[0]?.organization_id;
            if (!orgId) return NextResponse.json({ ok: true });

            // Atualizar timestamp da conversa para subir na lista
            await supabase.from('inbox_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('organization_id', orgId)
                .eq('channel', 'whatsapp')
                .eq('contact_id', phone);

            return NextResponse.json({ ok: true });
        }

        // ── MESSAGES_UPDATE — confirmação de entrega/leitura ─────────────────
        if (event === 'messages.update') {
            const remoteJid: string = body.data?.[0]?.key?.remoteJid || body.data?.key?.remoteJid || '';
            if (!remoteJid || !instanceName) return NextResponse.json({ ok: true });

            const phone = remoteJid.split('@')[0].split(':')[0];

            const { data: integrations } = await supabase
                .from('integrations')
                .select('organization_id')
                .eq('channel', 'whatsapp')
                .filter('config->>instanceName', 'eq', instanceName);

            const orgId = integrations?.[0]?.organization_id;
            if (!orgId) return NextResponse.json({ ok: true });

            await supabase.from('inbox_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('organization_id', orgId)
                .eq('channel', 'whatsapp')
                .eq('contact_id', phone);

            return NextResponse.json({ ok: true });
        }

        // ── Ignorar outros eventos que não sejam de mensagem ─────────────────
        if (!event.includes('message')) {
            return NextResponse.json({ ignored: true, event });
        }

        // ── MESSAGES_UPSERT — mensagem nova (recebida OU enviada pelo celular) ─
        const fromMe: boolean = body.data?.key?.fromMe === true;
        const remoteJid: string = body.data?.key?.remoteJid
            || body.data?.remoteJid
            || body.sender
            || '';

        if (!remoteJid || !instanceName) {
            return NextResponse.json({ ignored: true, reason: 'no remoteJid or instance' });
        }

        // Pular grupos e broadcasts
        if (remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
            return NextResponse.json({ ignored: true, reason: 'group or broadcast' });
        }

        const messageText: string = body.data?.message?.conversation
            || body.data?.message?.extendedTextMessage?.text
            || body.data?.message?.imageMessage?.caption
            || body.message
            || '';

        // Extract media data (audio, video, image)
        const mediaUrl: string = body.data?.message?.audioMessage?.url
            || body.data?.message?.videoMessage?.url
            || body.data?.message?.imageMessage?.url
            || '';

        const mimeType: string = body.data?.message?.audioMessage?.mimetype
            || body.data?.message?.videoMessage?.mimetype
            || body.data?.message?.imageMessage?.mimetype
            || '';

        // Ignore only if both text and media are missing
        if (!messageText && !mediaUrl) {
            return NextResponse.json({ ignored: true, reason: 'no text or media content' });
        }

        const phone = remoteJid.split('@')[0].split(':')[0];

        // ── Encontrar org e integração pela instância ──────────────────────────────────────
        const { data: integrations } = await supabase
            .from('integrations')
            .select('id, organization_id, config')
            .eq('channel', 'whatsapp')
            .filter('config->>instanceName', 'eq', instanceName);

        const integration = integrations?.[0];
        if (!integration) {
            console.error('[WA] Integration not found for instance:', instanceName);
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        const orgId = integration.organization_id;
        const whatsappInstanceId = integration.id;

        // ── Se é mensagem enviada pelo celular (fromMe: true no MESSAGES_UPSERT):
        // Apenas atualiza a conversa — o CRM já salva quando envia pelo app.
        // Evita duplicatas sem precisar de external_id.
        if (fromMe) {
            await supabase.from('inbox_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('organization_id', orgId)
                .eq('channel', 'whatsapp')
                .eq('contact_id', phone);
            return NextResponse.json({ ok: true, note: 'fromMe: timestamp updated' });
        }

        // ── Mensagem RECEBIDA (fromMe: false) ─────────────────────────────────

        // Match de origem por regex
        let originId: string | null = null;
        const { data: origins } = await supabase
            .from('lead_origins')
            .select('id, name, auto_match_regex')
            .eq('organization_id', orgId);

        if (origins?.length) {
            for (const origin of origins) {
                if (origin.auto_match_regex?.trim()) {
                    try {
                        if (new RegExp(origin.auto_match_regex, 'i').test(messageText)) {
                            originId = origin.id;
                            break;
                        }
                    } catch { /* regex inválida */ }
                }
            }
            if (!originId) {
                const organic = origins.find((o: any) => o.name === 'WhatsApp Orgânico');
                if (organic) originId = organic.id;
            }
        }

        // Buscar ou criar conversa
        const { data: existingConv } = await supabase
            .from('inbox_conversations')
            .select('id, status')
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp')
            .eq('contact_id', phone)
            .maybeSingle();

        let conversationId: string;

        if (existingConv) {
            conversationId = existingConv.id;
            // Update conversation with latest WhatsApp instance + timestamp
            // This ensures replies go back to whoever messaged last
            await supabase.from('inbox_conversations')
                .update({
                    updated_at: new Date().toISOString(),
                    whatsapp_instance_id: whatsappInstanceId,
                })
                .eq('id', conversationId);
        } else {
            const { data: newConv, error: convErr } = await supabase
                .from('inbox_conversations')
                .insert({
                    organization_id: orgId,
                    channel: 'whatsapp',
                    contact_id: phone,
                    status: 'pending',
                    origin_id: originId,
                    whatsapp_instance_id: whatsappInstanceId,
                })
                .select('id')
                .single();

            if (convErr || !newConv) throw new Error(convErr?.message || 'Falha ao criar conversa');
            conversationId = newConv.id;
        }

        // Salvar mensagem
        await supabase.from('messages').insert({
            organization_id: orgId,
            conversation_id: conversationId,
            direction: 'in',
            body: messageText || null,
            mime_type: mimeType || null,
            media_url: mediaUrl || null,
        });

        console.log('[WA] mensagem salva, conv:', conversationId, '| contato:', phone);
        return NextResponse.json({ success: true, conversationId });

    } catch (error: any) {
        console.error('[WA webhook] Error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
