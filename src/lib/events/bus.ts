import { createClient } from '@/lib/supabase/server';
import { sendFacebookConversion } from '@/lib/conversions/facebook';
import { sendGA4Conversion } from '@/lib/conversions/ga4';

export interface EventPayload {
    organization_id: string;
    event_name: 'message_received' | 'first_response_sent' | 'stage_changed' | 'lead_created';
    entity_type: 'lead' | 'message' | 'conversation';
    entity_id: string;
    payload?: any;
}

export async function appendEvent(event: EventPayload) {
    const supabase = await createClient();

    // 1. Log to DB
    const { error } = await supabase.from('event_log').insert({
        organization_id: event.organization_id,
        event_name: event.event_name,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        payload: event.payload
    });

    if (error) {
        console.error('Failed to log event:', error);
        // Don't throw, we want resilient event logging
    }

    // 2. Process Conversions (Async Fire & Forget)
    if (process.env.FEATURE_CONVERSIONS === 'true') {
        // In a real app, this should be a queue/background job.
        // Here we await it or run it floating to not block main thread heavily, 
        // but Next.js server actions / API routes usually want you to look await everything.
        // We will await to ensure execution in this serverless context.
        await processConversions(event);
    }
}

async function processConversions(event: EventPayload) {
    try {
        if (event.event_name === 'stage_changed' || event.event_name === 'lead_created') {
            const leadId = event.event_name === 'lead_created' ? event.entity_id : event.payload?.lead_id;

            // Parallel execution
            await Promise.all([
                sendFacebookConversion(event.event_name, leadId, event.payload),
                sendGA4Conversion(event.event_name, leadId, event.payload)
            ]);
        }
    } catch (error) {
        console.error('Conversion processing error:', error);
    }
}
