import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  verifyIGWebhookSignature,
  extractMessagesFromIGWebhook,
  IGWebhookPayload,
} from '@/lib/instagram/webhook'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-hub-signature-256') ?? ''
  if (!verifyIGWebhookSignature(rawBody, signature, process.env.INSTAGRAM_APP_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: IGWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  setImmediate(() => processIGWebhook(payload).catch(console.error))

  return NextResponse.json({ received: true })
}

async function processIGWebhook(payload: IGWebhookPayload) {
  const supabase = createServiceClient()
  const messages = extractMessagesFromIGWebhook(payload)

  for (const { accountId, senderId, messaging } of messages) {
    try {
      // Find channel
      const { data: channel } = await supabase
        .schema('messaging')
        .from('channels')
        .select('id, workspace_id')
        .eq('instagram_account_id', accountId)
        .eq('is_active', true)
        .single()

      if (!channel) continue

      // Upsert contact
      const { data: existingContact } = await supabase
        .schema('crm')
        .from('contacts')
        .select('id')
        .eq('workspace_id', channel.workspace_id)
        .eq('instagram_id', senderId)
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
            instagram_id: senderId,
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
        .eq('external_id', senderId)
        .single()

      let conversationId: string
      const text = messaging.message?.text ?? null
      const attachmentType = messaging.message?.attachments?.[0]?.type ?? null

      if (existingConv) {
        conversationId = existingConv.id
        await supabase
          .schema('messaging')
          .from('conversations')
          .update({
            last_message: text ?? `[${attachmentType ?? 'mensagem'}]`,
            last_message_at: new Date(messaging.timestamp).toISOString(),
            is_unread: true,
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
            external_id: senderId,
            status: 'open',
            is_unread: true,
            last_message: text ?? `[${attachmentType ?? 'mensagem'}]`,
            last_message_at: new Date(messaging.timestamp).toISOString(),
          })
          .select('id')
          .single()

        if (!newConv) continue
        conversationId = newConv.id

        // Create lead
        const { data: firstStage } = await supabase
          .schema('crm')
          .from('pipeline_stages')
          .select('id')
          .eq('workspace_id', channel.workspace_id)
          .eq('is_won', false)
          .eq('is_lost', false)
          .order('position')
          .limit(1)
          .single()

        const { data: lead } = await supabase
          .schema('crm')
          .from('leads')
          .insert({
            workspace_id: channel.workspace_id,
            contact_id: contactId,
            stage_id: firstStage?.id ?? null,
            title: 'Novo Lead Instagram',
            source: 'instagram',
            medium: 'direct',
            score: 10,
            temperature: 'warm',
          })
          .select('id')
          .single()

        if (lead) {
          await supabase
            .schema('messaging')
            .from('conversations')
            .update({ lead_id: lead.id })
            .eq('id', conversationId)
        }
      }

      // Save message
      const msgType = messaging.message?.attachments?.[0]?.type === 'image' ? 'image'
        : messaging.message?.attachments?.[0]?.type === 'audio' ? 'audio'
        : messaging.message?.attachments?.[0]?.type === 'video' ? 'video'
        : 'text'

      await supabase
        .schema('messaging')
        .from('messages')
        .insert({
          conversation_id: conversationId,
          workspace_id: channel.workspace_id,
          direction: 'inbound',
          sender_type: 'contact',
          type: msgType,
          content: text,
          media_url: messaging.message?.attachments?.[0]?.payload?.url ?? null,
          external_id: messaging.message?.mid,
          status: 'delivered',
        })
    } catch (err) {
      console.error('Error processing IG message:', err)
    }
  }
}
