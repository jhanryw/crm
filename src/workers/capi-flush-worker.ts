// ============================================================
// CAPI Flush Worker — sends queued events to Meta/Google
// Runs every 5 minutes. Retries failed events up to 5 times.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { sendCAPIEvent } from '@/lib/meta-capi/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_ATTEMPTS = 5
const BATCH_SIZE = 50

export async function capiFlushWorker() {
  console.log('[CAPIWorker] Flushing queued events...')

  try {
    const { data: events, error } = await supabase
      .schema('capi_queue')
      .from('events')
      .select('*')
      .eq('status', 'pending')
      .lte('send_after', new Date().toISOString())
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at')
      .limit(BATCH_SIZE)

    if (error) throw error
    if (!events || events.length === 0) {
      console.log('[CAPIWorker] No pending events.')
      return
    }

    console.log(`[CAPIWorker] Processing ${events.length} events...`)

    for (const event of events) {
      // Mark as in-flight
      await supabase
        .schema('capi_queue')
        .from('events')
        .update({
          attempts: event.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', event.id)

      try {
        if (event.platform === 'meta') {
          const pixelId = process.env.META_PIXEL_ID!
          const token = process.env.META_CAPI_ACCESS_TOKEN!
          const testCode = process.env.NODE_ENV !== 'production'
            ? process.env.META_TEST_EVENT_CODE
            : undefined

          const response = await sendCAPIEvent(pixelId, token, event.payload, testCode)

          await supabase
            .schema('capi_queue')
            .from('events')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              response,
            })
            .eq('id', event.id)

          // Update attribution touch_events
          if (event.contact_id) {
            await supabase
              .schema('attribution')
              .from('touch_events')
              .update({
                capi_sent: true,
                capi_sent_at: new Date().toISOString(),
                capi_event_id: event.event_id,
              })
              .eq('contact_id', event.contact_id)
              .eq('capi_sent', false)
          }

          console.log(`[CAPIWorker] Sent event ${event.event_name} (${event.id})`)
        }

        // Google Ads: implement similarly when needed
        if (event.platform === 'google') {
          // TODO: Google Ads offline conversions API
          await supabase
            .schema('capi_queue')
            .from('events')
            .update({ status: 'skipped' })
            .eq('id', event.id)
        }
      } catch (sendErr: any) {
        const isMaxAttempts = event.attempts + 1 >= MAX_ATTEMPTS
        await supabase
          .schema('capi_queue')
          .from('events')
          .update({
            status: isMaxAttempts ? 'failed' : 'pending',
            error: sendErr?.message ?? 'unknown error',
            // Exponential backoff: retry after 2^attempts minutes
            send_after: new Date(
              Date.now() + Math.pow(2, event.attempts) * 60 * 1000
            ).toISOString(),
          })
          .eq('id', event.id)

        console.error(`[CAPIWorker] Error sending event ${event.id}:`, sendErr?.message)
      }
    }

    console.log('[CAPIWorker] Done.')
  } catch (err) {
    console.error('[CAPIWorker] Fatal error:', err)
  }
}
