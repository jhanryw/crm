import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyERPWebhookSignature, parseERPWebhookEvent, saleToActivityTitle } from '@/lib/erp/integration'
import { buildPurchaseEvent } from '@/lib/meta-capi/client'
import { generateEventId, normalizePhone } from '@/lib/utils'

// ─── POST: receive events from ERP ──────────────────────────
// ERP sends: sale.created | sale.updated | sale.refunded
// CRM must verify HMAC, store event (idempotent), process it.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-qarvon-signature') ?? ''
  if (!verifyERPWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = parseERPWebhookEvent(JSON.parse(rawBody))
  } catch (err) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .schema('crm')
    .from('erp_sale_events')
    .select('id, processed')
    .eq('event_id', event.event_id)
    .single()

  if (existing?.processed) {
    return NextResponse.json({ status: 'already_processed' })
  }

  // Store the event
  await supabase
    .schema('crm')
    .from('erp_sale_events')
    .upsert({
      event_id: event.event_id,
      event_type: event.event_type,
      payload: event.payload,
      processed: false,
    }, { onConflict: 'event_id' })

  // Process async
  setImmediate(() => processERPEvent(event).catch(console.error))

  return NextResponse.json({ received: true })
}

// Local types for query results (no generated DB types)
interface ContactRow {
  id: string
  workspace_id: string
  name: string | null
  phone: string | null
}

interface LeadRow {
  id: string
  stage_id: string | null
  workspace_id: string
  ctwa_clid: string | null
}

async function processERPEvent(event: ReturnType<typeof parseERPWebhookEvent>) {
  const supabase = createServiceClient()
  const { payload, event_type, event_id } = event

  try {
    // Find contact by phone or erp_customer_id
    let contact: ContactRow | null = null

    if (payload.customer_phone) {
      const phone = `+${normalizePhone(payload.customer_phone)}`
      const { data } = await supabase
        .schema('crm')
        .from('contacts')
        .select('id, workspace_id, name, phone')
        .eq('phone', phone)
        .limit(1)
        .single()
      contact = data as ContactRow | null
    } else if (payload.erp_customer_id) {
      const { data } = await supabase
        .schema('crm')
        .from('contacts')
        .select('id, workspace_id, name, phone')
        .eq('erp_customer_id', payload.erp_customer_id)
        .limit(1)
        .single()
      contact = data as ContactRow | null
    }

    // Update erp_sale_events with contact reference
    if (contact) {
      // Update contact revenue
      if (event_type === 'sale.created') {
        await supabase
          .schema('crm')
          .from('contacts')
          .update({
            total_revenue: supabase.rpc('increment', { x: payload.total }) as any,
            purchase_count: supabase.rpc('increment', { x: 1 }) as any,
            last_purchase_at: payload.created_at,
            erp_customer_id: payload.erp_customer_id ?? undefined,
          })
          .eq('id', contact.id)

        // Find associated lead
        const { data: rawLead } = await supabase
          .schema('crm')
          .from('leads')
          .select('id, stage_id, workspace_id, ctwa_clid')
          .eq('contact_id', contact.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        const lead = rawLead as LeadRow | null

        if (lead) {
          // Find won stage
          const { data: wonStage } = await supabase
            .schema('crm')
            .from('pipeline_stages')
            .select('id')
            .eq('workspace_id', lead.workspace_id)
            .eq('is_won', true)
            .limit(1)
            .single()

          // Update lead to won
          await supabase
            .schema('crm')
            .from('leads')
            .update({
              status: 'won',
              stage_id: wonStage?.id ?? lead.stage_id,
              won_at: payload.created_at,
            })
            .eq('id', lead.id)

          // Add activity
          await supabase
            .schema('crm')
            .from('lead_activities')
            .insert({
              lead_id: lead.id,
              workspace_id: lead.workspace_id,
              type: 'purchase',
              title: saleToActivityTitle(event_type, payload),
              metadata: { sale_id: payload.sale_id, total: payload.total, items: payload.items },
            })

          // Queue CAPI Purchase event
          await supabase
            .schema('capi_queue')
            .from('events')
            .upsert({
              workspace_id: lead.workspace_id,
              platform: 'meta',
              event_name: 'Purchase',
              event_id: generateEventId(`purchase_${payload.sale_id}`),
              contact_id: contact.id,
              lead_id: lead.id,
              payload: buildPurchaseEvent({
                eventId: generateEventId(`purchase_${payload.sale_id}`),
                phone: contact.phone,
                ctwaClid: lead.ctwa_clid,
                value: payload.total,
                currency: payload.currency,
                orderId: payload.sale_id,
                contactId: contact.id,
              }),
              status: 'pending',
            }, { onConflict: 'platform,event_id', ignoreDuplicates: true })
        }
      }

      if (event_type === 'sale.refunded') {
        await supabase
          .schema('crm')
          .from('contacts')
          .update({
            total_revenue: supabase.rpc('decrement', { x: payload.total }) as any,
          })
          .eq('id', contact.id)
      }

      // Mark event as processed
      await supabase
        .schema('crm')
        .from('erp_sale_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          contact_id: contact.id,
        })
        .eq('event_id', event_id)
    } else {
      // Mark processed even if contact not found (avoid retry loops)
      await supabase
        .schema('crm')
        .from('erp_sale_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('event_id', event_id)
    }
  } catch (err: any) {
    await supabase
      .schema('crm')
      .from('erp_sale_events')
      .update({ error: err?.message ?? 'unknown error' })
      .eq('event_id', event_id)
    throw err
  }
}
