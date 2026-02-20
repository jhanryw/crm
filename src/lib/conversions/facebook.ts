export async function sendFacebookConversion(eventName: string, leadId: string, data: any) {
    console.log(`[Facebook CAPI Stub] Sending ${eventName} for Lead ${leadId}`, data);
    // Real implementation would fetch Lead email/phone, hash it, and POST to Graph API.
}
