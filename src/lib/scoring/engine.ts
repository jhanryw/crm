// ============================================================
// Lead Scoring Engine
// Computes a 0–100 score based on behavioral and demographic signals.
// ============================================================

import { LeadScoreFactors, LeadTemperature } from '@/types'

interface ScoreRule {
  label: string
  points: number
  condition: (f: LeadScoreFactors) => boolean
}

const SCORE_RULES: ScoreRule[] = [
  // ─── Demographic completeness ───────────────────────────
  {
    label: 'Tem telefone',
    points: 10,
    condition: f => f.has_phone,
  },
  {
    label: 'Tem email',
    points: 5,
    condition: f => f.has_email,
  },

  // ─── Purchase history ───────────────────────────────────
  {
    label: 'Já comprou 1x',
    points: 20,
    condition: f => f.purchase_count >= 1,
  },
  {
    label: 'Já comprou 3+ vezes',
    points: 10,
    condition: f => f.purchase_count >= 3,
  },
  {
    label: 'Receita total > R$500',
    points: 10,
    condition: f => f.total_revenue >= 500,
  },
  {
    label: 'Receita total > R$2000',
    points: 10,
    condition: f => f.total_revenue >= 2000,
  },

  // ─── Engagement ─────────────────────────────────────────
  {
    label: 'Mensagem recente (< 24h)',
    points: 15,
    condition: f => f.days_since_last_message !== null && f.days_since_last_message <= 1,
  },
  {
    label: 'Mensagem recente (< 3 dias)',
    points: 10,
    condition: f =>
      f.days_since_last_message !== null &&
      f.days_since_last_message > 1 &&
      f.days_since_last_message <= 3,
  },
  {
    label: 'Muito engajado (10+ msgs)',
    points: 10,
    condition: f => f.messages_count >= 10,
  },

  // ─── Attribution quality ────────────────────────────────
  {
    label: 'Veio de campanha paga',
    points: 5,
    condition: f => f.campaign_source,
  },
  {
    label: 'Tem ctwa_clid (click em ad)',
    points: 10,
    condition: f => f.ctwa_clid,
  },

  // ─── Pipeline progress ──────────────────────────────────
  {
    label: 'Avançou no pipeline',
    points: 10,
    condition: f =>
      f.max_stage_position > 0 &&
      f.stage_position / f.max_stage_position >= 0.5,
  },

  // ─── Penalties ──────────────────────────────────────────
  {
    label: 'Lead antigo sem contato (> 30 dias)',
    points: -15,
    condition: f =>
      f.days_since_last_message !== null &&
      f.days_since_last_message > 30,
  },
  {
    label: 'Lead muito antigo (> 60 dias)',
    points: -10,
    condition: f => f.days_since_created > 60,
  },
]

export interface ScoreResult {
  score: number
  temperature: LeadTemperature
  breakdown: Array<{ label: string; points: number }>
}

export function computeLeadScore(factors: LeadScoreFactors): ScoreResult {
  const breakdown: Array<{ label: string; points: number }> = []
  let raw = 0

  for (const rule of SCORE_RULES) {
    if (rule.condition(factors)) {
      breakdown.push({ label: rule.label, points: rule.points })
      raw += rule.points
    }
  }

  // Clamp to 0–100
  const score = Math.min(100, Math.max(0, raw))

  let temperature: LeadTemperature
  if (score >= 75) temperature = 'burning'
  else if (score >= 55) temperature = 'hot'
  else if (score >= 35) temperature = 'warm'
  else temperature = 'cold'

  return { score, temperature, breakdown }
}

// ─── Suggest next action based on score & state ─────────────

export function suggestNextAction(
  score: number,
  temperature: LeadTemperature,
  daysSinceLastMessage: number | null,
  purchaseCount: number
): string {
  if (temperature === 'burning' || score >= 75) {
    return 'Ligar agora — lead pronto para fechar'
  }
  if (temperature === 'hot') {
    return 'Enviar proposta ou template de oferta'
  }
  if (daysSinceLastMessage === null || daysSinceLastMessage > 7) {
    return 'Reativar lead com mensagem de follow-up'
  }
  if (purchaseCount === 0 && score >= 35) {
    return 'Qualificar e enviar apresentação do produto'
  }
  if (purchaseCount > 0) {
    return 'Oferta de upsell ou produto complementar'
  }
  return 'Nutrir lead com conteúdo relevante'
}
