'use server';

import { appendEvent, EventPayload } from '@/lib/events/bus';

export async function logEvent(event: EventPayload) {
    try {
        await appendEvent(event);
    } catch (error) {
        console.error('Failed to log event via Server Action:', error);
        // We generally don't want to crash the client for a logging failure
    }
}
