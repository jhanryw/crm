// ============================================================
// WhatsApp Cloud API Client
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
// ============================================================

import axios, { AxiosInstance } from 'axios'

const WA_API_VERSION = 'v21.0'
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`

export interface WASendTextParams {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  previewUrl?: boolean
}

export interface WASendTemplateParams {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language: string
  components?: WaTemplateComponent[]
}

export interface WASendMediaParams {
  phoneNumberId: string
  accessToken: string
  to: string
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker'
  mediaUrl?: string
  mediaId?: string
  caption?: string
  filename?: string
}

export interface WaTemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video'
    text?: string
    image?: { link: string }
    document?: { link: string }
  }>
  sub_type?: 'url' | 'quick_reply'
  index?: number
}

export interface WASendResponse {
  messaging_product: 'whatsapp'
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string; message_status?: string }>
}

function buildClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: WA_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
}

export async function sendTextMessage({
  phoneNumberId,
  accessToken,
  to,
  text,
  previewUrl = false,
}: WASendTextParams): Promise<WASendResponse> {
  const client = buildClient(accessToken)
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text, preview_url: previewUrl },
  })
  return data
}

export async function sendTemplateMessage({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  language,
  components = [],
}: WASendTemplateParams): Promise<WASendResponse> {
  const client = buildClient(accessToken)
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  })
  return data
}

export async function sendMediaMessage({
  phoneNumberId,
  accessToken,
  to,
  type,
  mediaUrl,
  mediaId,
  caption,
  filename,
}: WASendMediaParams): Promise<WASendResponse> {
  const client = buildClient(accessToken)
  const mediaObject: Record<string, unknown> = {}
  if (mediaId) mediaObject.id = mediaId
  if (mediaUrl) mediaObject.link = mediaUrl
  if (caption) mediaObject.caption = caption
  if (filename) mediaObject.filename = filename

  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type,
    [type]: mediaObject,
  })
  return data
}

export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  const client = buildClient(accessToken)
  await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<string> {
  const client = buildClient(accessToken)
  const { data } = await client.get(`/${mediaId}`)
  return data.url
}

export async function downloadMedia(
  mediaUrl: string,
  accessToken: string
): Promise<Buffer> {
  const response = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
  })
  return Buffer.from(response.data)
}
