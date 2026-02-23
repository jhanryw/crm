import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(request: NextRequest) {
    const supabase = getSupabase();
    try {
        const body = await request.json();

        // Exemplo genérico de payload recebido de uma API de Instagram DMs
        const instagramContact = body.sender || "unknown_ig";
        const messageText = body.text || "Nova DM Instagram";
        const accountId = body.accountId || body.instance;

        if (!accountId) {
            return NextResponse.json({ error: 'Account ID obrigatório' }, { status: 400 });
        }

        // 1. Achar a organização dona dessa integração/instância
        const { data: integration } = await supabase
            .from('integrations')
            .select('organization_id')
            .eq('id', accountId)
            .eq('channel', 'instagram')
            .single();

        if (!integration) {
            return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
        }

        const orgId = integration.organization_id;

        // 2. Tentar achar origem regex (ex: veio com resposta ao story "CAMP-123")
        let originId = null;
        const { data: origins } = await supabase
            .from('lead_origins')
            .select('id, auto_match_regex')
            .eq('organization_id', orgId);

        if (origins && origins.length > 0) {
            for (const origin of origins) {
                // Checar se origin.auto_match_regex é uma string não vazia primeiro
                if (origin.auto_match_regex && origin.auto_match_regex.trim() !== '') {
                    try {
                        const regex = new RegExp(origin.auto_match_regex, 'i');
                        if (regex.test(messageText)) {
                            originId = origin.id;
                            break;
                        }
                    } catch (e) {
                        // Ignite regex parsing errors gracefully
                    }
                }
            }
            // Fallback para Instagram Orgânico
            if (!originId) {
                const organic = origins.find((o: any) => o.name === 'Instagram Orgânico');
                if (organic) originId = organic.id;
            }
        }

        // 3. Checar se a conversa já existe
        let { data: conversation } = await supabase
            .from('inbox_conversations')
            .select('id, status')
            .eq('organization_id', orgId)
            .eq('channel', 'instagram')
            .eq('contact_id', instagramContact)
            .single();

        let conversationId = conversation?.id;

        // Se não existe, cria como PENDENTE
        if (!conversationId) {
            const { data: newConv, error: convError } = await supabase
                .from('inbox_conversations')
                .insert({
                    organization_id: orgId,
                    channel: 'instagram',
                    contact_id: instagramContact,
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
        console.error('Erro no webhook de Instagram:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
