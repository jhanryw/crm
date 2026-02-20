import { createClient } from '@/lib/supabase/server';
import { LeadWebhookPayloadSchema } from '@/lib/validators/webhooks';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ token: string }> }
) {
    // Await params specifically for Next.js 15+ (if applicable) or generally safe practice now
    const { token } = await context.params;

    const supabase = await createClient();

    // 1. Validate Token & Get Organization
    const { data: webhook, error: hookError } = await supabase
        .from('webhooks')
        .select('organization_id, origin, active')
        .eq('token', token)
        .single();

    if (hookError || !webhook) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!webhook.active) {
        return NextResponse.json({ error: 'Webhook is inactive' }, { status: 403 });
    }

    // 2. Validate Payload
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = LeadWebhookPayloadSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const payload = validation.data;

    try {
        // 3. Resolve Stage (First one)
        const { data: firstStage } = await supabase
            .from('stages')
            .select('id')
            .eq('organization_id', webhook.organization_id)
            .order('order_index', { ascending: true })
            .limit(1)
            .single();

        if (!firstStage) {
            return NextResponse.json({ error: 'No stages defined for organization' }, { status: 500 });
        }

        // 4. Resolve Campaign ID if code provided
        let campaignId = null;
        if (payload.campaign_code) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('id')
                .eq('organization_id', webhook.organization_id)
                .eq('tracking_code', payload.campaign_code)
                .single();
            if (campaign) campaignId = campaign.id;
        }

        // 5. Create Lead
        // Mapped fields: source (from payload or webhook origin)
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .insert({
                organization_id: webhook.organization_id,
                contact_name: payload.contact_name || payload.contact_email || 'Unknown Lead',
                contact_phone: payload.contact_phone,
                source: payload.source || webhook.origin,
                campaign_id: campaignId,
                stage_id: firstStage.id,
                value: payload.value || 0
            })
            .select('id')
            .single();

        if (leadError) throw leadError;

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            attributed_campaign: campaignId ? payload.campaign_code : null
        });

    } catch (error: any) {
        console.error('Webhook Lead Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
