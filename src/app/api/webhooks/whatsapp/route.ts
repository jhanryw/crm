import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  verifyWebhookSignature,
  extractMessagesFromWebhook,
  extractStatusesFromWebhook,
  WAWebhookPayload,
} from '@/lib/whatsapp/webhook'
import { normalizePhone, generateEventId } from '@/lib/utils'

// ─── GET: webhook verification challenge ────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── POST: incoming messages & status updates ───────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify Meta signature
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  if (!verifyWebhookSignature(rawBody, signature, process.env.META_APP_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: WAWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process async — respond immediately (Meta requires < 20s)
  setImmediate(() => processWhatsAppWebhook(payload).catch(console.error))

  return NextResponse.json({ received: true })
}

async function processWhatsAppWebhook(payload: WAWebhookPayload) {
  const supabase = createServiceClient()

  // ─── Handle inbound messages ──────────────────────────────
  const inboundMessages = extractMessagesFromWebhook(payload)

  for (const { phoneNumberId, message, contact } of inboundMessages) {
    try {
      // Find channel by phone_number_id
      const { data: channel } = await supabase
        .schema('messaging')
        .from('channels')
        .select('id, workspace_id, access_token')
        .eq('phone_number_id', phoneNumberId)
        .eq('is_active', true)
        .single()

      if (!channel) continue

      const senderPhone = `+${message.from}`
      const normalizedPhone = normalizePhone(message.from)

      // Upsert contact
      const { data: existingContact } = await supabase
        .schema('crm')
        .from('contacts')
        .select('id')
        .eq('workspace_id', channel.workspace_id)
        .eq('phone', senderPhone)
        .single()

      let contactId: string

      if (existingContact) {
        contactId = existingContact.id
      } else {
        const { data: newContact } = await supabase
          .schema('crm')
          .from('contacts')
          .insert({
            workspace_id: channel.workspace_id,
            phone: senderPhone,
            whatsapp_id: normalizedPhone,
            name: contact?.profile.name ?? null,
          })
          .select('id')
          .single()

        if (!newContact) continue
        contactId = newContact.id
      }

      // Upsert conversation
      const { data: existingConv } = await supabase
        .schema('messaging')
        .from('conversations')
        .select('id')
        .eq('channel_id', channel.id)
        .eq('external_id', message.from)
        .single()

      let conversationId: string
      const ctwaClid = message.referral?.ctwa_clid ?? null

      if (existingConv) {
        conversationId = existingConv.id
        // Update last message
        await supabase
          .schema('messaging')
          .from('conversations')
          .update({
            last_message: message.text?.body ?? `[${message.type}]`,
            last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
            is_unread: true,
            status: 'open',
          })
          .eq('id', conversationId)
      } else {
        const { data: newConv } = await supabase
          .schema('messaging')
          .from('conversations')
          .insert({
            workspace_id: channel.workspace_id,
            channel_id: channel.id,
            contact_id: contactId,
            external_id: message.from,
            status: 'open',
            is_unread: true,
            last_message: message.text?.body ?? `[${message.type}]`,
            last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
            ctwa_clid: ctwaClid,
          })
          .select('id')
          .single()

        if (!newConv) continue
        conversationId = newConv.id

        // Create a lead if first contact
        await createLeadFromInbound({
          supabase,
          workspaceId: channel.workspace_id,
          contactId,
          conversationId,
          ctwaClid,
          referral: message.referral,
        })
      }

      // Save message
      await supabase
        .schema('messaging')
        .from('messages')
        .insert({
          conversation_id: conversationId,
          workspace_id: channel.workspace_id,
          direction: 'inbound',
          sender_type: 'contact',
          type: message.type as any,
          content: message.text?.body ?? null,
          media_url: null, // resolve media URL lazily
          external_id: message.id,
          status: 'delivered',
          ctwa_clid: ctwaClid,
          referral: message.referral ?? null,
        })

      // Queue CAPI Lead event if ctwa_clid present
      if (ctwaClid) {
        await supabase
          .schema('capi_queue')
          .from('events')
          .upsert({
            workspace_id: channel.workspace_id,
            platform: 'meta',
            event_name: 'Lead',
            event_id: generateEventId(`lead_wa_${contactId}`),
            contact_id: contactId,
            payload: {
              ctwa_clid: ctwaClid,
              phone: senderPhone,
              channel: 'whatsapp',
            },
            status: 'pending',
          }, { onConflict: 'platform,event_id', ignoreDuplicates: true })
      }
    } catch (err) {
      console.error('Error processing WA message:', err)
    }
  }

  // ─── Handle status updates ────────────────────────────────
  const statuses = extractStatusesFromWebhook(payload)
  for (const { status } of statuses) {
    await supabase
      .schema('messaging')
      .from('messages')
      .update({
        status: status.status as any,
        status_updated_at: new Date(Number(status.timestamp) * 1000).toISOString(),
        error_code: status.errors?.[0]?.code?.toString() ?? null,
        error_message: status.errors?.[0]?.message ?? null,
      })
      .eq('external_id', status.id)
  }
}

async function createLeadFromInbound({
  supabase,
  workspaceId,
  contactId,
  conversationId,
  ctwaClid,
  referral,
}: {
  supabase: ReturnType<typeof createServiceClient>
  workspaceId: string
  contactId: string
  conversationId: string
  ctwaClid: string | null
  referral?: { source_id?: string; source_url?: string } | null
}) {
  // Get first open stage
  const { data: firstStage } = await supabase
    .schema('crm')
    .from('pipeline_stages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_won', false)
    .eq('is_lost', false)
    .order('position')
    .limit(1)
    .single()

  const { data: lead } = await supabase
    .schema('crm')
    .from('leads')
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      stage_id: firstStage?.id ?? null,
      title: 'Novo Lead WhatsApp',
      source: ctwaClid ? 'paid' : 'whatsapp',
      medium: ctwaClid ? 'cpc' : 'direct',
      ctwa_clid: ctwaClid,
      score: ctwaClid ? 25 : 10,
      temperature: 'warm',
    })
    .select('id')
    .single()

  if (lead) {
    // Link conversation to lead
    await supabase
      .schema('messaging')
      .from('conversations')
      .update({ lead_id: lead.id })
      .eq('id', conversationId)
  }
}
