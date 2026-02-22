'use server';

import { createClient } from '@supabase/supabase-js';
import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function requireAuth() {
    const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
    if (!isAuthenticated || !claims?.sub) {
        throw new Error("Unauthorized");
    }

    const { data: user } = await supabase
        .from('users')
        .select('organization_id, role, id')
        .eq('logto_id', claims.sub)
        .single();

    if (!user) throw new Error("User org not found");
    return { logtoId: claims.sub, orgId: user.organization_id, role: user.role, userId: user.id };
}

export async function getConversations() {
    const { orgId } = await requireAuth();
    const { data } = await supabase
        .from('inbox_conversations')
        .select('*, lead_origins(name), leads(*)')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false });
    return data || [];
}

export async function getMessages(conversationId: string) {
    const { orgId } = await requireAuth();
    const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('organization_id', orgId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    return data || [];
}

export async function sendMessage(conversationId: string, text: string) {
    const { orgId } = await requireAuth();

    const { data: conv } = await supabase
        .from('inbox_conversations')
        .select('channel, contact_id')
        .eq('id', conversationId)
        .single();

    if (!conv) throw new Error("Conversation not found");

    // Simulando disparo para o contato (ex: via Evolution API ou Instagram Graph API)...
    // No ambiente real, faríamos um POST para envio de mensagem aqui.
    console.log(`[MVP] Disparando mensagem via ${conv.channel} para ${conv.contact_id}: ${text}`);

    const { error } = await supabase
        .from('messages')
        .insert({
            organization_id: orgId,
            conversation_id: conversationId,
            direction: 'out',
            body: text
        });

    if (error) throw new Error(error.message);
    revalidatePath('/inbox');
    return { success: true };
}

export async function approveConversationAsLead(conversationId: string) {
    const { orgId, userId } = await requireAuth();

    const { data: conv } = await supabase
        .from('inbox_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (!conv) throw new Error("Conversation not found");

    // Get the first stage
    const { data: stage } = await supabase
        .from('stages')
        .select('id')
        .eq('organization_id', orgId)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();

    const originSource = conv.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram';

    // Create the lead
    const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
            organization_id: orgId,
            assigned_to: userId,
            origin_id: conv.origin_id, // Atribui a mesma origem da conversa (pelo webhook)
            source: originSource,
            stage_id: stage?.id || null, // Pipeline stage
            contact_name: conv.contact_id // MVP: using phone or ID as name initially
        })
        .select()
        .single();

    if (leadErr) throw new Error(leadErr.message);

    // Update conversation to active
    await supabase.from('inbox_conversations').update({ status: 'active' }).eq('id', conversationId);

    revalidatePath('/inbox');
    revalidatePath('/kanban');
    return newLead;
}

export async function archiveConversation(conversationId: string) {
    const { orgId } = await requireAuth();
    await supabase.from('inbox_conversations').update({ status: 'archived' }).eq('id', conversationId).eq('organization_id', orgId);
    revalidatePath('/inbox');
}
