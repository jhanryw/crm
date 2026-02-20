export async function sendGA4Conversion(eventName: string, leadId: string, data: any) {
    console.log(`[GA4 Stub] Sending ${eventName} for Lead ${leadId}`, data);
    // Real implementation would POST to GA4 Measurement Protocol endpoint.
}
