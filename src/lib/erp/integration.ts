// ============================================================
// ERP Integration Layer
// The CRM communicates with the ERP ONLY via:
//   1. ERP's REST API (read)
//   2. ERP Webhooks (push) — events like sale.created
//
// The CRM NEVER touches ERP database tables directly.
// ============================================================

import { ERPWebhookEvent, ERPSalePayload } from '@/types'

const ERP_BASE_URL = process.env.ERP_BASE_URL!
const ERP_API_KEY = process.env.ERP_API_KEY!

// ─── ERP API Client (read-only queries) ─────────────────────

export async function getERPCustomer(customerId: string): Promise<ERPCustomer | null> {
  try {
    const res = await fetch(`${ERP_BASE_URL}/api/customers/${customerId}`, {
      headers: { 'X-API-Key': ERP_API_KEY },
      next: { revalidate: 60 }, // cache 60s
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getERPCustomerByPhone(phone: string): Promise<ERPCustomer | null> {
  try {
    const res = await fetch(`${ERP_BASE_URL}/api/customers?phone=${encodeURIComponent(phone)}`, {
      headers: { 'X-API-Key': ERP_API_KEY },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.customers?.[0] ?? null
  } catch {
    return null
  }
}

export async function getERPCustomerSales(customerId: string): Promise<ERPSale[]> {
  try {
    const res = await fetch(`${ERP_BASE_URL}/api/customers/${customerId}/sales`, {
      headers: { 'X-API-Key': ERP_API_KEY },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.sales ?? []
  } catch {
    return []
  }
}

// ─── Webhook Signature Verification ─────────────────────────

export function verifyERPWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.ERP_WEBHOOK_SECRET!
  const { createHmac } = require('crypto')
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  return expected === signature
}

// ─── ERP Event Processor ────────────────────────────────────

export function parseERPWebhookEvent(body: unknown): ERPWebhookEvent {
  // Validate shape
  const event = body as Record<string, unknown>
  if (!event.event_id || !event.event_type || !event.payload) {
    throw new Error('Invalid ERP webhook event shape')
  }
  return event as unknown as ERPWebhookEvent
}

// ─── ERP Types (mirrored, not imported) ─────────────────────
// We define our own types for ERP data — no shared code with ERP.

export interface ERPCustomer {
  id: string
  name: string
  phone?: string
  email?: string
  cpf?: string
  created_at: string
}

export interface ERPSale {
  id: string
  customer_id: string
  total: number
  currency: string
  status: 'paid' | 'pending' | 'refunded' | 'cancelled'
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total: number
  }>
  created_at: string
  paid_at?: string
}

// ─── Map ERP sale → CRM lead activity ────────────────────────

export function saleToActivityTitle(
  eventType: string,
  payload: ERPSalePayload
): string {
  const val = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: payload.currency ?? 'BRL',
  }).format(payload.total)

  const map: Record<string, string> = {
    'sale.created': `Venda criada: ${val}`,
    'sale.updated': `Venda atualizada: ${val}`,
    'sale.refunded': `Venda estornada: ${val}`,
  }
  return map[eventType] ?? `Evento de venda: ${val}`
}
