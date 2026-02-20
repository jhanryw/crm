import { z } from 'zod';

export const LeadWebhookPayloadSchema = z.object({
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
    contact_email: z.string().email().optional(),
    source: z.string().optional(), // If not provided, will default to webhook origin
    campaign_code: z.string().optional(),
    value: z.number().optional(),
    data: z.record(z.any()).optional(), // Extra metadata
});

export type LeadWebhookPayload = z.infer<typeof LeadWebhookPayloadSchema>;
