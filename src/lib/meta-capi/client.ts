// ============================================================
// Meta Conversions API (CAPI) Client
// The CRM sends conversion events to Meta — the ERP does NOT.
// ============================================================

interface CAPIUserData {
  em?: string[]   // hashed emails
  ph?: string[]   // hashed phones
  fn?: string[]   // hashed first names
  ln?: string[]   // hashed last names
  fbp?: string    // _fbp cookie
  fbc?: string    // _fbc cookie or ctwa_clid
  client_ip_address?: string
  client_user_agent?: string
  external_id?: string[]
}

interface CAPICustomData {
  value?: number
  currency?: string
  content_ids?: string[]
  content_name?: string
  content_type?: string
  num_items?: number
  order_id?: string
}

interface CAPIEvent {
  event_name: string              // Purchase | Lead | Contact | InitiateCheckout
  event_time: number              // Unix timestamp
  event_id: string                // deduplication ID
  action_source: 'business_messaging_whatsapp' | 'app' | 'website' | 'crm'
  user_data: CAPIUserData
  custom_data?: CAPICustomData
  messaging_channel?: 'whatsapp' | 'instagram'
}

interface CAPIResponse {
  events_received: number
  messages?: string[]
  fbtrace_id: string
}

function sha256(data: string): string {
  const { createHash } = require('crypto')
  return createHash('sha256').update(data.trim().toLowerCase()).digest('hex')
}

function hashPhone(phone: string): string {
  // Normalize to E.164 without + then hash
  const digits = phone.replace(/\D/g, '')
  return sha256(digits)
}

export async function sendCAPIEvent(
  pixelId: string,
  accessToken: string,
  event: CAPIEvent,
  testEventCode?: string
): Promise<CAPIResponse> {
  const url = `https://graph.facebook.com/v21.0/${pixelId}/events`

  const body: Record<string, unknown> = {
    data: [event],
  }
  if (testEventCode) {
    body.test_event_code = testEventCode
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`CAPI error: ${JSON.stringify(err)}`)
  }

  return res.json()
}

// ─── High-level helpers ──────────────────────────────────────

export function buildPurchaseEvent(params: {
  eventId: string
  phone?: string | null
  email?: string | null
  name?: string | null
  ctwaClid?: string | null
  fbclid?: string | null
  value: number
  currency?: string
  orderId?: string
  contactId?: string
}): CAPIEvent {
  const userData: CAPIUserData = {}

  if (params.phone) userData.ph = [hashPhone(params.phone)]
  if (params.email) userData.em = [sha256(params.email)]
  if (params.name) {
    const [fn, ...rest] = params.name.split(' ')
    userData.fn = [sha256(fn)]
    if (rest.length) userData.ln = [sha256(rest.join(' '))]
  }
  if (params.ctwaClid) userData.fbc = params.ctwaClid
  if (params.fbclid) userData.fbc = params.fbclid
  if (params.contactId) userData.external_id = [sha256(params.contactId)]

  return {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    action_source: 'business_messaging_whatsapp',
    user_data: userData,
    custom_data: {
      value: params.value,
      currency: params.currency ?? 'BRL',
      order_id: params.orderId,
    },
  }
}

export function buildLeadEvent(params: {
  eventId: string
  phone?: string | null
  email?: string | null
  ctwaClid?: string | null
  contactId?: string
  channel?: 'whatsapp' | 'instagram'
}): CAPIEvent {
  const userData: CAPIUserData = {}
  if (params.phone) userData.ph = [hashPhone(params.phone)]
  if (params.email) userData.em = [sha256(params.email)]
  if (params.ctwaClid) userData.fbc = params.ctwaClid
  if (params.contactId) userData.external_id = [sha256(params.contactId)]

  return {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    action_source: params.channel === 'whatsapp'
      ? 'business_messaging_whatsapp'
      : 'crm',
    messaging_channel: params.channel,
    user_data: userData,
  }
}
