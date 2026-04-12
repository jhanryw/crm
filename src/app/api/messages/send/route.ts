import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage, sendMediaMessage, sendTemplateMessage } from '@/lib/whatsapp/client'
import { sendIGMessage } from '@/lib/instagram/webhook'
import { SendMessageRequest } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: SendMessageRequest = await req.json()

  // Get conversation + channel
  const { data: conversation, error } = await supabase
    .schema('messaging')
    .from('conversations')
    .select(`
      *,
      channel:messaging.channels(*)
    `)
    .eq('id', body.conversation_id)
    .single()

  if (error || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Get agent
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

  const channel = (conversation as any).channel

  try {
    let externalId: string | null = null

    if (channel.type === 'whatsapp') {
      if (body.type === 'text' && body.content) {
        const res = await sendTextMessage({
          phoneNumberId: channel.phone_number_id,
          accessToken: channel.access_token,
          to: conversation.external_id!,
          text: body.content,
        })
        externalId = res.messages[0]?.id ?? null
      } else if (body.type === 'template' && body.template_name) {
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

    // Save message to DB
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

    // Update conversation last_message
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
  } catch (err: any) {
    console.error('Send message error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Failed to send message' },
      { status: 500 }
    )
  }
}
