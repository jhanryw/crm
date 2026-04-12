import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "'Hoje,' HH:mm", { locale: ptBR })
  if (isYesterday(date)) return format(date, "'Ontem,' HH:mm", { locale: ptBR })
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR })
}

export function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '—'
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR })
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  // E.164 → (XX) XXXXX-XXXX
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const num = digits.slice(4)
    if (num.length === 9) return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
    return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`
  }
  return phone
}

export function temperatureColor(temp: string): string {
  const map: Record<string, string> = {
    cold: 'text-blue-400 bg-blue-400/10',
    warm: 'text-yellow-400 bg-yellow-400/10',
    hot: 'text-orange-400 bg-orange-400/10',
    burning: 'text-red-400 bg-red-400/10',
  }
  return map[temp] ?? 'text-gray-400 bg-gray-400/10'
}

export function temperatureLabel(temp: string): string {
  const map: Record<string, string> = {
    cold: 'Frio',
    warm: 'Morno',
    hot: 'Quente',
    burning: 'Em Chamas',
  }
  return map[temp] ?? temp
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

export function channelIcon(type: string): string {
  return type === 'whatsapp' ? '📱' : '📸'
}

export function truncate(str: string, max = 60): string {
  if (str.length <= max) return str
  return str.slice(0, max - 3) + '...'
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits.startsWith('55') && digits.length <= 11) {
    return `55${digits}`
  }
  return digits
}

export function generateEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function hmacVerify(
  body: string,
  signature: string,
  secret: string
): boolean {
  // Runtime HMAC verification — used in webhook handlers
  const { createHmac } = require('crypto')
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return expected === signature
}
