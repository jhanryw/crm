// ============================================================
// WhatsApp Webhook Payload Types & Parser
// ============================================================

export interface WAWebhookPayload {
  object: 'whatsapp_business_account'
  entry: WAEntry[]
}

export interface WAEntry {
  id: string  // WABA ID
  changes: WAChange[]
}

export interface WAChange {
  value: WAValue
  field: 'messages'
}

export interface WAValue {
  messaging_product: 'whatsapp'
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: WAContact[]
  messages?: WAMessage[]
  statuses?: WAStatus[]
}

export interface WAContact {
  profile: { name: string }
  wa_id: string
}

export interface WAMessage {
  from: string         // sender phone number (without +)
  id: string           // wamid
  timestamp: string
  type: string
  text?: { body: string }
  image?: WAMedia
  audio?: WAMedia
  video?: WAMedia
  document?: WAMedia & { filename?: string }
  sticker?: WAMedia
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  reaction?: { message_id: string; emoji: string }
  interactive?: { type: string; list_reply?: { id: string; title: string }; button_reply?: { id: string; title: string } }
  referral?: {
    source_url: string
    source_id: string
    source_type: string
    headline: string
    body: string
    media_type: string
    image_url?: string
    ctwa_clid?: string
  }
  context?: {
    from: string
    id: string
    forwarded?: boolean
    referred_product?: { catalog_id: string; product_retailer_id: string }
  }
}

export interface WAMedia {
  id: string
  mime_type: string
  sha256?: string
  caption?: string
}

export interface WAStatus {
  id: string           // wamid
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string; message: string; error_data?: { details: string } }>
}

// ─── Parse helpers ──────────────────────────────────────────

export function extractMessagesFromWebhook(payload: WAWebhookPayload): {
  phoneNumberId: string
  message: WAMessage
  contact: WAContact | undefined
}[] {
  const results: { phoneNumberId: string; message: WAMessage; contact: WAContact | undefined }[] = []

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      const { value } = change
      if (!value.messages) continue

      for (const message of value.messages) {
        const contact = value.contacts?.find(c => c.wa_id === message.from)
        results.push({ phoneNumberId: value.metadata.phone_number_id, message, contact })
      }
    }
  }

  return results
}

export function extractStatusesFromWebhook(payload: WAWebhookPayload): {
  phoneNumberId: string
  status: WAStatus
}[] {
  const results: { phoneNumberId: string; status: WAStatus }[] = []

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      const { value } = change
      if (!value.statuses) continue

      for (const status of value.statuses) {
        results.push({ phoneNumberId: value.metadata.phone_number_id, status })
      }
    }
  }

  return results
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  appSecret: string
): boolean {
  const { createHmac } = require('crypto')
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  return expected === signature
}
