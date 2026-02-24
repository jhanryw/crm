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
    // Evolution API verifica o webhook com GET
    return NextResponse.json({ status: 'ok' });
}

export async function POST(request: NextRequest) {
    const supabase = getSupabase();
    try {
        const body = await request.json();

        // Normalise event name — Evolution API sends lowercase ("connection.update")
        // but we also accept uppercase variants
        const event: string = (body.event || body.type || '').toLowerCase();
        const instanceName: string = body.instance || body.instanceName || body.instanceId || '';

        console.log('[WA webhook]', event, instanceName);

        // ── Connection status update ──────────────────────────────────────────
        if (event === 'connection.update') {
            const state: string = (body.data?.state || '').toLowerCase();

            if (instanceName && state === 'open') {
                const { error } = await supabase
                    .from('integrations')
                    .update({ status: 'connected', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);

                if (error) console.error('[WA webhook] update connected error:', error.message);
                else console.log('[WA webhook] status → connected', instanceName);

            } else if (instanceName && (state === 'close' || state === 'closed')) {
                await supabase
                    .from('integrations')
                    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
            }

            return NextResponse.json({ success: true });
        }

        // ── QR code updated (new QR generated) ───────────────────────────────
        if (event === 'qrcode.updated') {
            const base64: string | null = body.data?.qrcode?.base64
                || body.data?.base64
                || body.qrcode?.base64
                || null;

            if (instanceName && base64) {
                // Strip data URI prefix if present
                const rawBase64 = base64.startsWith('data:') ? base64.split(',')[1] ?? base64 : base64;
                await supabase
                    .from('integrations')
                    .update({
                        status: 'connecting',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('channel', 'whatsapp')
                    .filter('config->>instanceName', 'eq', instanceName);
                // Note: we don't overwrite the full config here to keep instanceName intact
                // The frontend polls and will show the stored QR if needed
                console.log('[WA webhook] QR updated for', instanceName, 'base64 length:', rawBase64?.length);
            }

            return NextResponse.json({ success: true });
        }

        // ── Ignore non-message events ─────────────────────────────────────────
        if (event && !event.includes('message')) {
            return NextResponse.json({ ignored: true, event });
        }

        // ── Incoming message (messages.upsert) ────────────────────────────────
        const fromMe = body.data?.key?.fromMe === true;
        if (fromMe) {
            return NextResponse.json({ ignored: true, reason: 'fromMe' });
        }

        const phoneContact = (body.data?.key?.remoteJid || body.sender || 'unknown')
            .split('@')[0].split(':')[0];

        const messageText = body.data?.message?.conversation
            || body.data?.message?.extendedTextMessage?.text
            || body.data?.message?.imageMessage?.caption
            || body.message
            || '';

        if (!instanceName || !messageText) {
            return NextResponse.json({ ignored: true, reason: 'no instance or message' });
        }

        // 1. Find org by instanceName
        const { data: integrations } = await supabase
            .from('integrations')
            .select('organization_id, config')
            .eq('channel', 'whatsapp')
            .filter('config->>instanceName', 'eq', instanceName);

        const integration = integrations?.[0];
        if (!integration) {
            console.error('[WA webhook] Integration not found for instance:', instanceName);
            return NextResponse.json({ error: 'Integration not found: ' + instanceName }, { status: 404 });
        }

        const orgId = integration.organization_id;

        // 2. Match origin via regex
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
                    } catch { /* invalid regex, skip */ }
                }
            }
            if (!originId) {
                const organic = origins.find(o => o.name === 'WhatsApp Orgânico');
                if (organic) originId = organic.id;
            }
        }

        // 3. Find or create conversation
        const { data: existingConv } = await supabase
            .from('inbox_conversations')
            .select('id, status')
            .eq('organization_id', orgId)
            .eq('channel', 'whatsapp')
            .eq('contact_id', phoneContact)
            .maybeSingle();

        let conversationId: string;

        if (existingConv) {
            conversationId = existingConv.id;
            await supabase
                .from('inbox_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);
        } else {
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

            if (convErr || !newConv) throw new Error(convErr?.message || 'Failed to create conversation');
            conversationId = newConv.id;
        }

        // 4. Save message
        await supabase.from('messages').insert({
            organization_id: orgId,
            conversation_id: conversationId,
            direction: 'in',
            body: messageText,
        });

        console.log('[WA webhook] message saved, conv:', conversationId);
        return NextResponse.json({ success: true, conversationId });

    } catch (error: any) {
        console.error('[WA webhook] Error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
