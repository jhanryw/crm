'use server';

import { requireAuth, getServiceSupabase } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

export async function getConversations() {
    const { orgId } = await requireAuth();
    const { data } = await getServiceSupabase()
        .from('inbox_conversations')
        .select('*, lead_origins(name), leads(*)')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false });
    return data || [];
}

export async function getMessages(conversationId: string) {
    const { orgId } = await requireAuth();
    const { data } = await getServiceSupabase()
        .from('messages')
        .select('*')
        .eq('organization_id', orgId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    return data || [];
}

export async function sendMessage(conversationId: string, text: string) {
    const { orgId } = await requireAuth();

    const { data: conv } = await getServiceSupabase()
        .from('inbox_conversations')
        .select('channel, contact_id, organization_id')
        .eq('id', conversationId)
        .eq('organization_id', orgId)
        .single();

    if (!conv) throw new Error("Conversa não encontrada");

    // Enviar via canal correto
    if (conv.channel === 'whatsapp') {
        await sendWhatsAppMessage(orgId, conv.contact_id, text);
    } else if (conv.channel === 'instagram') {
        await sendInstagramMessage(orgId, conv.contact_id, text);
    }

    // Salvar mensagem enviada no banco
    const { error } = await getServiceSupabase().from('messages').insert({
        organization_id: orgId,
        conversation_id: conversationId,
        direction: 'out',
        body: text,
    });

    if (error) throw new Error(error.message);
    revalidatePath('/inbox');
    return { success: true };
}

async function sendWhatsAppMessage(orgId: string, contactId: string, text: string) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn('[WhatsApp] Evolution API não configurada — mensagem salva apenas no banco.');
        return;
    }

    // Buscar instanceName da integração da org
    const { data: integration } = await getServiceSupabase()
        .from('integrations')
        .select('config, status')
        .eq('organization_id', orgId)
        .eq('channel', 'whatsapp')
        .single();

    if (!integration || integration.status !== 'connected') {
        throw new Error("WhatsApp não está conectado. Configure em Definições.");
    }

    const instanceName = integration.config?.instanceName;
    if (!instanceName) throw new Error("instanceName não encontrado na configuração do WhatsApp.");

    // Número no formato internacional sem o +
    const number = contactId.replace(/\D/g, '');

    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Erro ao enviar WhatsApp: ${err}`);
    }
}

async function sendInstagramMessage(orgId: string, contactUsername: string, text: string) {
    const { data: integration } = await getServiceSupabase()
        .from('integrations')
        .select('config, status')
        .eq('organization_id', orgId)
        .eq('channel', 'instagram')
        .single();

    if (!integration || integration.status !== 'connected') {
        throw new Error("Instagram não está conectado. Configure em Definições.");
    }

    const sessionData = integration.config?.session;
    if (!sessionData) throw new Error("Sessão do Instagram não encontrada.");

    try {
        const { IgApiClient } = await import('instagram-private-api');
        const ig = new IgApiClient();
        await ig.state.deserialize(JSON.parse(sessionData));

        // ig.user.search() returns UserRepositorySearchResponseRootObject { users: User[] }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const searchResult: any = await ig.user.search(contactUsername);
        const recipient = searchResult?.users?.[0] ?? searchResult?.[0];
        if (!recipient) throw new Error(`Usuário Instagram não encontrado: ${contactUsername}`);

        const thread = ig.entity.directThread([String(recipient.pk)]);
        await thread.broadcastText(text);
    } catch (err: any) {
        throw new Error(`Erro ao enviar Instagram: ${err.message}`);
    }
}

export async function approveConversationAsLead(conversationId: string) {
    const { orgId, userId } = await requireAuth();

    const { data: conv } = await getServiceSupabase()
        .from('inbox_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('organization_id', orgId)
        .single();

    if (!conv) throw new Error("Conversa não encontrada");

    const { data: stage } = await getServiceSupabase()
        .from('stages')
        .select('id')
        .eq('organization_id', orgId)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();

    const originSource = conv.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram';

    const { data: newLead, error: leadErr } = await getServiceSupabase()
        .from('leads')
        .insert({
            organization_id: orgId,
            assigned_to: userId,
            origin_id: conv.origin_id,
            source: originSource,
            stage_id: stage?.id || null,
            contact_name: conv.contact_id,
            contact_phone: conv.channel === 'whatsapp' ? conv.contact_id : null,
        })
        .select()
        .single();

    if (leadErr) throw new Error(leadErr.message);

    await getServiceSupabase()
        .from('inbox_conversations')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    revalidatePath('/inbox');
    revalidatePath('/kanban');
    return newLead;
}

export async function archiveConversation(conversationId: string) {
    const { orgId } = await requireAuth();
    await getServiceSupabase()
        .from('inbox_conversations')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('organization_id', orgId);
    revalidatePath('/inbox');
}
