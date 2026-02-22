import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos Service Role aqui pois webhooks não vêm com o JWT do Logto logado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Exemplo genérico de payload recebido de uma API de WhatsApp Web (ex: Evolution API)
        const phoneContact = body.data?.key?.remoteJid?.split('@')[0] || body.sender || "unknown";
        const messageText = body.data?.message?.conversation || body.message || "Nova Mensagem";
        const instanceId = body.instance || body.instanceId;

        if (!instanceId) {
            return NextResponse.json({ error: 'Instance ID obrigatório' }, { status: 400 });
        }

        // 1. Achar a organização dona dessa integração/instância
        const { data: integration } = await supabase
            .from('integrations')
            .select('organization_id')
            .eq('id', instanceId)
            .eq('channel', 'whatsapp')
            .single();

        if (!integration) {
            return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
        }

        const orgId = integration.organization_id;

        // 2. Tentar achar origem regex (ex: veio com "CAMP-123")
        let originId = null;
        const { data: origins } = await supabase
            .from('lead_origins')
            .select('id, auto_match_regex')
            .eq('organization_id', orgId);

        if (origins && origins.length > 0) {
            for (const origin of origins) {
                if (origin.auto_match_regex && origin.auto_match_regex.trim() !== '') {
                    try {
                        const regex = new RegExp(origin.auto_match_regex, 'i');
                        if (regex.test(messageText)) {
                            originId = origin.id;
                            break;
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
            }
            // Fallback para Whatsapp Orgânico
            if (!originId) {
                const organic = origins.find((o: any) => o.name === 'WhatsApp Orgânico');
                if (organic) originId = organic.id;
            }
        }

        // 3. Checar se a conversa já existe
        let { data: conversation } = await supabase
            .from('inbox_conversations')
            .select('id, status')
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp')
            .eq('contact_id', phoneContact)
            .single();

        let conversationId = conversation?.id;

        // Se não existe, cria como PENDENTE
        if (!conversationId) {
            const { data: newConv, error: convError } = await supabase
                .from('inbox_conversations')
                .insert({
                    organization_id: orgId,
                    channel: 'whatsapp',
                    contact_id: phoneContact,
                    status: 'pending',
                    origin_id: originId
                })
                .select('id')
                .single();

            if (convError) throw convError;
            conversationId = newConv.id;
        }

        // 4. Salvar a nova mensagem
        await supabase
            .from('messages')
            .insert({
                organization_id: orgId,
                conversation_id: conversationId,
                direction: 'in',
                body: messageText
            });

        return NextResponse.json({ success: true, conversationId });

    } catch (error: any) {
        console.error('Erro no webhook de WhatsApp:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
