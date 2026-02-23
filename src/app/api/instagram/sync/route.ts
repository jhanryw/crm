import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// GET /api/instagram/sync?orgId=xxx
// Chamado pelo InboxClient para sincronizar DMs do Instagram
export async function GET(request: NextRequest) {
    const supabase = getSupabase();
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inboxFeed = ig.feed.directInbox() as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const threads: any[] = await inboxFeed.items();

        let synced = 0;

        // Buscar origens da org para atribuição
        const { data: origins } = await supabase
            .from('lead_origins')
            .select('id, name')
            .eq('organization_id', orgId);

        const instagramOrganicOrigin = origins?.find(o => o.name === 'Instagram Orgânico');

        for (const thread of threads.slice(0, 20)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const t = thread as any;
            const contactUsername = t.users?.[0]?.username as string | undefined;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const threadItems: any[] = t.items || [];
            for (const item of threadItems.slice(0, 10)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const it = item as any;
                if (it.item_type !== 'text') continue;

                const messageBody = it.text as string;
                const direction = String(it.user_id) === String(t.viewer_id) ? 'out' : 'in';
                const tsMs = Number(it.timestamp) / 1000;
                const createdAt = new Date(tsMs).toISOString();

                // Verificar se mensagem já existe (por timestamp aproximado)
                const { data: existing } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('conversation_id', conversationId)
                    .eq('body', messageBody)
                    .eq('direction', direction)
                    .gte('created_at', new Date(tsMs - 2000).toISOString())
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
