// ============================================================
// Instagram Direct Webhook Payload Types & Parser
// ============================================================

export interface IGWebhookPayload {
  object: 'instagram'
  entry: IGEntry[]
}

export interface IGEntry {
  id: string        // Instagram page/account ID
  time: number
  messaging?: IGMessaging[]
  changes?: IGChange[]
}

export interface IGMessaging {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: IGMessage
  read?: { watermark: number }
  delivery?: { watermarks: number[]; seq: number }
  postback?: { mid: string; title: string; payload: string }
}

export interface IGMessage {
  mid: string
  text?: string
  attachments?: IGAttachment[]
  reply_to?: { mid: string }
  is_echo?: boolean
  is_unsupported?: boolean
  quick_reply?: { payload: string }
}

export interface IGAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'story_mention' | 'share' | 'like_heart' | 'media_share' | 'ig_reel' | 'reel' | 'ig_media_share' | 'story_reply' | 'animated_image'
  payload: {
    url?: string
    title?: string
    sticker_id?: number
    reel_video_id?: string
  }
}

export interface IGChange {
  field: string
  value: Record<string, unknown>
}

export function extractMessagesFromIGWebhook(payload: IGWebhookPayload): {
  accountId: string
  senderId: string
  messaging: IGMessaging
}[] {
  const results: { accountId: string; senderId: string; messaging: IGMessaging }[] = []

  for (const entry of payload.entry) {
    if (!entry.messaging) continue
    for (const msg of entry.messaging) {
      // Skip echoes (messages sent by the page)
      if (msg.message?.is_echo) continue
      results.push({
        accountId: entry.id,
        senderId: msg.sender.id,
        messaging: msg,
      })
    }
  }

  return results
}

export function verifyIGWebhookSignature(
  rawBody: string,
  signature: string,
  appSecret: string
): boolean {
  const { createHmac } = require('crypto')
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  return expected === signature
}

// ─── Instagram Graph API helpers ────────────────────────────

export async function sendIGMessage(
  recipientId: string,
  pageAccessToken: string,
  message: { text?: string; attachment?: { type: string; payload: { url: string; is_reusable?: boolean } } }
): Promise<{ message_id: string; recipient_id: string }> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message,
        messaging_type: 'RESPONSE',
      }),
    }
  )
  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Instagram send failed: ${JSON.stringify(err)}`)
  }
  return response.json()
}
