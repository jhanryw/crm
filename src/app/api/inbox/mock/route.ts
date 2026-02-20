import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractTrackingCode, sanitizeMessage } from '@/lib/attribution/tracking';
import { appendEvent } from '@/lib/events/bus';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const body = await req.json();

    const { contact, channel, message, force_organization_id } = body;

    // Manual Validation (simple check)
    if (!contact || !channel || !message) {
        return NextResponse.json({ error: 'Missing contact, channel or message' }, { status: 400 });
    }

    try {
        // 1. Attribution Logic
        const trackingCode = extractTrackingCode(message);
        const cleanMessage = trackingCode ? sanitizeMessage(message, trackingCode) : message;

        // 2. Get Organization
        let orgId = force_organization_id;
        if (!orgId) {
            const { data: orgs } = await supabase.from('organizations').select('id').limit(1).single();
            orgId = orgs?.id;
        }

        if (!orgId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 500 });
        }

        // 3. Resolve Campaign from Tracking Code
        let campaignId = null;
        if (trackingCode) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('id')
                .eq('organization_id', orgId)
                .eq('tracking_code', trackingCode)
                .single();
            if (campaign) campaignId = campaign.id;
        }

        // 4. Check/Create Conversation
        let conversationId;
        const { data: existingConv } = await supabase
            .from('inbox_conversations')
            .select('id')
            .eq('organization_id', orgId)
            .eq('contact_id', contact)
            .eq('channel', channel)
            .single();

        if (existingConv) {
            conversationId = existingConv.id;
        } else {
            // Create new Conversation
            const { data: newConv, error: convError } = await supabase
                .from('inbox_conversations')
                .insert({
                    organization_id: orgId,
                    contact_id: contact,
                    channel: channel,
                    status: 'active'
                })
                .select('id')
                .single();

            if (convError) throw convError;
            conversationId = newConv.id;

            // 5. Create Lead for new Conversation
            const { data: firstStage } = await supabase
                .from('stages')
                .select('id')
                .eq('organization_id', orgId)
                .order('order_index', { ascending: true })
                .limit(1)
                .single();

            if (firstStage) {
                const { data: lead } = await supabase.from('leads').insert({
                    organization_id: orgId,
                    contact_name: contact,
                    source: 'inbox_mock',
                    campaign_id: campaignId, // Attribute Campaign
                    stage_id: firstStage.id,
                    value: 0
                }).select('id').single();

                // Log Lead Creation Event
                if (lead) {
                    await appendEvent({
                        organization_id: orgId,
                        event_name: 'lead_created',
                        entity_type: 'lead',
                        entity_id: lead.id,
                        payload: { source: 'inbox', campaign_id: campaignId, tracking_code: trackingCode }
                    });
                }
            }
        }

        // 6. Insert Message
        // Store cleaned body as the main body.
        const { data: msgData, error: msgError } = await supabase.from('messages').insert({
            organization_id: orgId,
            conversation_id: conversationId,
            direction: 'in',
            body: cleanMessage,
            campaign_id: campaignId
        }).select('id').single();

        if (msgError) throw msgError;

        // 7. Log Message Event
        if (msgData) {
            await appendEvent({
                organization_id: orgId,
                event_name: 'message_received',
                entity_type: 'message',
                entity_id: msgData.id,
                payload: { conversation_id: conversationId, has_tracking: !!trackingCode }
            });
        }

        return NextResponse.json({
            success: true,
            conversationId,
            attribution: {
                code: trackingCode,
                campaign_id: campaignId
            }
        });

    } catch (error: any) {
        console.error('Mock Inbox Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
