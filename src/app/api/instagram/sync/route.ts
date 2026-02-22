import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET /api/instagram/sync?orgId=xxx
// Chamado pelo InboxClient para sincronizar DMs do Instagram
export async function GET(request: NextRequest) {
    const orgId = request.nextUrl.searchParams.get('orgId');
    if (!orgId) {
        return NextResponse.json({ error: 'orgId obrigatório' }, { status: 400 });
    }

    try {
        // Buscar integração Instagram da org
        const { data: integration } = await supabase
            .from('integrations')
            .select('config, status')
            .eq('organization_id', orgId)
            .eq('channel', 'instagram')
            .single();

        if (!integration || integration.status !== 'connected') {
            return NextResponse.json({ synced: 0, reason: 'Instagram não conectado' });
        }

        const sessionData = integration.config?.session;
        if (!sessionData) {
            return NextResponse.json({ synced: 0, reason: 'Sessão não encontrada' });
        }

        const { IgApiClient } = await import('instagram-private-api');
        const ig = new IgApiClient();
        await ig.state.deserialize(JSON.parse(sessionData));

        // Buscar threads do inbox direto
        const inboxFeed = ig.feed.directInbox();
        const threads = await inboxFeed.items();

        let synced = 0;

        // Buscar origens da org para atribuição
        const { data: origins } = await supabase
            .from('lead_origins')
            .select('id, name')
            .eq('organization_id', orgId);

        const instagramOrganicOrigin = origins?.find(o => o.name === 'Instagram Orgânico');

        for (const thread of threads.slice(0, 20)) {
            const contactUsername = thread.users?.[0]?.username;
            if (!contactUsername) continue;

            // Encontrar ou criar conversa
            const { data: existingConv } = await supabase
                .from('inbox_conversations')
                .select('id')
                .eq('organization_id', orgId)
                .eq('channel', 'instagram')
                .eq('contact_id', contactUsername)
                .single();

            let conversationId = existingConv?.id;

            if (!conversationId) {
                const { data: newConv } = await supabase
                    .from('inbox_conversations')
                    .insert({
                        organization_id: orgId,
                        channel: 'instagram',
                        contact_id: contactUsername,
                        status: 'pending',
                        origin_id: instagramOrganicOrigin?.id || null,
                    })
                    .select('id')
                    .single();
                conversationId = newConv?.id;
            }

            if (!conversationId) continue;

            // Sincronizar mensagens do thread
            const threadItems = thread.items || [];
            for (const item of threadItems.slice(0, 10)) {
                if (item.item_type !== 'text') continue;

                const messageBody = item.text;
                const direction = item.user_id === thread.viewer_id ? 'out' : 'in';
                const createdAt = new Date(item.timestamp / 1000).toISOString();

                // Verificar se mensagem já existe (por timestamp aproximado)
                const { data: existing } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('conversation_id', conversationId)
                    .eq('body', messageBody)
                    .eq('direction', direction)
                    .gte('created_at', new Date(item.timestamp / 1000 - 2000).toISOString())
                    .single();

                if (!existing) {
                    await supabase.from('messages').insert({
                        organization_id: orgId,
                        conversation_id: conversationId,
                        direction,
                        body: messageBody,
                        created_at: createdAt,
                    });
                    synced++;
                }
            }

            // Atualizar updated_at da conversa
            await supabase
                .from('inbox_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);
        }

        return NextResponse.json({ synced });

    } catch (error: any) {
        console.error('[Instagram Sync]', error.message);
        return NextResponse.json({ synced: 0, error: error.message }, { status: 500 });
    }
}
