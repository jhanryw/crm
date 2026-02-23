import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
    // Evolution API verifica o webhook com GET em alguns casos
    return NextResponse.json({ status: 'ok' });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Handler de evento de conexão (QR code escaneado)
        if (body.event === 'connection.update') {
            const instanceName = body.instance;
            const state = body.data?.state;

            if (instanceName && state === 'open') {
                // WhatsApp conectado — atualizar status da integração
                await supabase
                    .from('integrations')
                    .update({ status: 'connected', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
            } else if (instanceName && (state === 'close' || state === 'connecting')) {
                await supabase
                    .from('integrations')
                    .update({ status: state === 'close' ? 'disconnected' : 'connecting', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
            }

            return NextResponse.json({ success: true });
        }

        // Ignorar eventos que não sejam de mensagens recebidas
        const event = body.event || '';
        if (event && !event.includes('message') && event !== '') {
            return NextResponse.json({ ignored: true, event });
        }

        // Extrair dados da mensagem
        // Evolution API v2 envia: { event: "messages.upsert", instance: "nome", data: { key: { remoteJid, fromMe }, message: { conversation } } }
        const fromMe = body.data?.key?.fromMe === true;
        if (fromMe) {
            // Ignorar mensagens enviadas pelo próprio número
            return NextResponse.json({ ignored: true, reason: 'fromMe' });
        }

        const phoneContact = (body.data?.key?.remoteJid || body.sender || 'unknown').split('@')[0].split(':')[0];
        const messageText = body.data?.message?.conversation
            || body.data?.message?.extendedTextMessage?.text
            || body.message
            || '';
        const instanceName = body.instance || body.instanceId;

        if (!instanceName || !messageText) {
            return NextResponse.json({ ignored: true, reason: 'no instance or message' });
        }

        // 1. Achar a organização por instanceName no config da integração
        const { data: integrations } = await supabase
            .from('integrations')
            .select('organization_id, config')
            .eq('channel', 'whatsapp')
            .filter('config->>instanceName', 'eq', instanceName);

        const integration = integrations?.[0];

        if (!integration) {
            return NextResponse.json({ error: 'Integração não encontrada para instância: ' + instanceName }, { status: 404 });
        }

        const orgId = integration.organization_id;

        // 2. Achar origem via regex
        let originId = null;
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
                    } catch { /* regex inválida, ignorar */ }
                }
            }
            if (!originId) {
                const organic = origins.find(o => o.name === 'WhatsApp Orgânico');
                if (organic) originId = organic.id;
            }
        }

        // 3. Encontrar ou criar conversa
        const { data: existingConv } = await supabase
            .from('inbox_conversations')
            .select('id, status')
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp')
            .eq('contact_id', phoneContact)
            .single();

        let conversationId = existingConv?.id;

        if (!conversationId) {
            const { data: newConv, error: convErr } = await supabase
                .from('inbox_conversations')
                .insert({
                    organization_id: orgId,
                    channel: 'whatsapp',
                    contact_id: phoneContact,
                    status: 'pending',
                    origin_id: originId,
                })
                .select('id')
                .single();

            if (convErr) throw convErr;
            conversationId = newConv.id;
        } else {
            // Atualizar updated_at da conversa para aparecer no topo
            await supabase
                .from('inbox_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);
        }

        // 4. Salvar mensagem
        await supabase.from('messages').insert({
            organization_id: orgId,
            conversation_id: conversationId,
            direction: 'in',
            body: messageText,
        });

        return NextResponse.json({ success: true, conversationId });

    } catch (error: any) {
        console.error('Erro no webhook WhatsApp:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
