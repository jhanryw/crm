import { createHash } from 'crypto';

function sha256(value: string): string {
    return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

export interface FacebookConversionParams {
    pixelId: string;
    accessToken: string;
    testEventCode?: string | null;
    leadId: string;
    value: number;
    currency?: string;
    phone?: string | null;
    email?: string | null;
}

export interface FacebookConversionResult {
    success: boolean;
    eventsReceived?: number;
    error?: string;
    rawResponse?: any;
}

export async function sendFacebookConversion(
    params: FacebookConversionParams
): Promise<FacebookConversionResult> {
    const {
        pixelId, accessToken, testEventCode,
        leadId, value, currency = 'BRL', phone, email,
    } = params;

    if (!pixelId || !accessToken) {
        return { success: false, error: 'Pixel ID ou Access Token não configurado.' };
    }

    // Build hashed user_data
    const userData: Record<string, string[]> = {};
    if (phone) {
        // Normalize: digits only, add country code if missing
        const digits = phone.replace(/\D/g, '');
        userData.ph = [sha256(digits)];
    }
    if (email) {
        userData.em = [sha256(email)];
    }

    const eventPayload: any = {
        data: [
            {
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                event_id: leadId,
                action_source: 'other',
                user_data: Object.keys(userData).length > 0 ? userData : { client_ip_address: '0.0.0.0' },
                custom_data: {
                    value: Number(value.toFixed(2)),
                    currency,
                },
            },
        ],
    };

    if (testEventCode) {
        eventPayload.test_event_code = testEventCode;
    }

    try {
        const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload),
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                success: false,
                error: data?.error?.message || `HTTP ${res.status}`,
                rawResponse: data,
            };
        }

        return {
            success: true,
            eventsReceived: data.events_received ?? 1,
            rawResponse: data,
        };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro de rede ao enviar para Meta.' };
    }
}
