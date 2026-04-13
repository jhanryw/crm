import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/client'
import { sendIGMessage } from '@/lib/instagram/webhook'
import { SendMessageRequest } from '@/types'

// Local type for the query result (no generated DB types)
interface ConversationRow {
  id: string
  workspace_id: string
  external_id: string | null
  channel: {
    id: string
    type: 'whatsapp' | 'instagram'
    phone_number_id: string | null
    access_token: string
  } | null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: SendMessageRequest = await req.json()

  // channel:channels(*) — no schema prefix needed when already in messaging schema
  const { data: rawConv, error } = await supabase
    .schema('messaging')
    .from('conversations')
    .select('id, workspace_id, external_id, channel:channels(id, type, phone_number_id, access_token)')
    .eq('id', body.conversation_id)
    .single()

  if (error || !rawConv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const conversation = rawConv as unknown as ConversationRow

  if (!conversation.channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  const { data: member } = await supabase
    .schema('crm')
    .from('workspace_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('workspace_id', conversation.workspace_id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
  }

  const channel = conversation.channel

  try {
    let externalId: string | null = null

    if (channel.type === 'whatsapp') {
      if (body.type === 'text' && body.content && channel.phone_number_id) {
        const res = await sendTextMessage({
          phoneNumberId: channel.phone_number_id,
          accessToken: channel.access_token,
          to: conversation.external_id!,
          text: body.content,
        })
        externalId = res.messages[0]?.id ?? null
      } else if (body.type === 'template' && body.template_name && channel.phone_number_id) {
        const res = await sendTemplateMessage({
          phoneNumberId: channel.phone_number_id,
          accessToken: channel.access_token,
          to: conversation.external_id!,
          templateName: body.template_name,
          language: 'pt_BR',
        })
        externalId = res.messages[0]?.id ?? null
      }
    } else if (channel.type === 'instagram') {
      if (body.type === 'text' && body.content) {
        const res = await sendIGMessage(
          conversation.external_id!,
          channel.access_token,
          { text: body.content }
        )
        externalId = res.message_id
      }
    }

    const { data: message } = await supabase
      .schema('messaging')
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: conversation.workspace_id,
        direction: 'outbound',
        sender_type: 'agent',
        sender_agent_id: member.id,
        type: body.type,
        content: body.content ?? null,
        template_name: body.template_name ?? null,
        external_id: externalId,
        status: 'sent',
      })
      .select()
      .single()

    await supabase
      .schema('messaging')
      .from('conversations')
      .update({
        last_message: body.content ?? `[${body.type}]`,
        last_message_at: new Date().toISOString(),
        is_unread: false,
      })
      .eq('id', conversation.id)

    return NextResponse.json({ message })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send message'
    console.error('[messages/send] error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
