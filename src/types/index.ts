// ============================================================
// Qarvon CRM — Core TypeScript Types
// ============================================================

// ─── Workspace ──────────────────────────────────────────────
export type WorkspacePlan = 'starter' | 'growth' | 'enterprise'
export type WorkspaceMemberRole = 'owner' | 'admin' | 'manager' | 'agent'

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: WorkspacePlan
  settings: WorkspaceSettings
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  timezone?: string
  business_hours?: BusinessHours
  auto_assign?: boolean
  lead_score_threshold_hot?: number   // default 70
  lead_score_threshold_warm?: number  // default 40
}

export interface BusinessHours {
  monday: TimeRange | null
  tuesday: TimeRange | null
  wednesday: TimeRange | null
  thursday: TimeRange | null
  friday: TimeRange | null
  saturday: TimeRange | null
  sunday: TimeRange | null
}

export interface TimeRange {
  open: string  // HH:mm
  close: string // HH:mm
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Contact ─────────────────────────────────────────────────
export interface Contact {
  id: string
  workspace_id: string
  name: string | null
  phone: string | null
  email: string | null
  instagram_id: string | null
  whatsapp_id: string | null
  erp_customer_id: string | null
  avatar_url: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
  total_revenue: number
  purchase_count: number
  last_purchase_at: string | null
  created_at: string
  updated_at: string
}

// ─── Lead ────────────────────────────────────────────────────
export type LeadTemperature = 'cold' | 'warm' | 'hot' | 'burning'
export type LeadStatus = 'open' | 'won' | 'lost' | 'archived'

export interface Lead {
  id: string
  workspace_id: string
  contact_id: string
  stage_id: string | null
  assigned_to: string | null
  title: string
  value: number | null
  currency: string
  score: number
  temperature: LeadTemperature
  next_action: string | null
  next_action_at: string | null
  source: string | null
  medium: string | null
  campaign_id: string | null
  creative_id: string | null
  ctwa_clid: string | null
  fbclid: string | null
  gclid: string | null
  status: LeadStatus
  won_at: string | null
  lost_at: string | null
  lost_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  contact?: Contact
  stage?: PipelineStage
  assigned_member?: WorkspaceMember
  campaign?: Campaign
}

export interface LeadWithContext extends Lead {
  contact: Contact
  stage: PipelineStage | null
  assigned_member: WorkspaceMember | null
  recent_activities: LeadActivity[]
  last_conversation: Conversation | null
}

// ─── Pipeline ────────────────────────────────────────────────
export interface PipelineStage {
  id: string
  workspace_id: string
  name: string
  color: string
  position: number
  is_won: boolean
  is_lost: boolean
  created_at: string
  // Computed
  leads_count?: number
  total_value?: number
}

// ─── Lead Activity ───────────────────────────────────────────
export type LeadActivityType =
  | 'note'
  | 'stage_change'
  | 'assignment'
  | 'score_update'
  | 'purchase'
  | 'message'
  | 'call'

export interface LeadActivity {
  id: string
  lead_id: string
  workspace_id: string
  actor_id: string | null
  type: LeadActivityType
  title: string
  body: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: WorkspaceMember
}

// ─── Messaging ───────────────────────────────────────────────
export type ChannelType = 'whatsapp' | 'instagram'

export interface Channel {
  id: string
  workspace_id: string
  type: ChannelType
  name: string
  phone_number_id: string | null
  phone_number: string | null
  waba_id: string | null
  instagram_account_id: string | null
  instagram_username: string | null
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'archived'

export interface Conversation {
  id: string
  workspace_id: string
  channel_id: string
  contact_id: string
  lead_id: string | null
  assigned_to: string | null
  external_id: string | null
  status: ConversationStatus
  is_unread: boolean
  last_message: string | null
  last_message_at: string | null
  ctwa_clid: string | null
  created_at: string
  updated_at: string
  // Joined
  contact?: Contact
  channel?: Channel
  lead?: Lead
  assigned_member?: WorkspaceMember
}

export type MessageDirection = 'inbound' | 'outbound'
export type MessageSenderType = 'contact' | 'agent' | 'bot' | 'system'
export type MessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'template'
  | 'interactive'
  | 'sticker'
  | 'reaction'
  | 'location'
  | 'unsupported'
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Message {
  id: string
  conversation_id: string
  workspace_id: string
  direction: MessageDirection
  sender_type: MessageSenderType
  sender_agent_id: string | null
  type: MessageType
  content: string | null
  media_url: string | null
  media_mime_type: string | null
  media_size: number | null
  template_name: string | null
  template_vars: Record<string, string> | null
  external_id: string | null
  status: MessageStatus
  status_updated_at: string | null
  error_code: string | null
  error_message: string | null
  ctwa_clid: string | null
  referral: WhatsAppReferral | null
  created_at: string
  updated_at: string
  sender_agent?: WorkspaceMember
}

export interface WhatsAppReferral {
  source_url?: string
  source_id?: string
  source_type?: string
  headline?: string
  body?: string
  media_type?: string
  image_url?: string
  ctwa_clid?: string
}

// ─── Attribution ─────────────────────────────────────────────
export type AdPlatform = 'meta' | 'google' | 'tiktok' | 'organic' | 'referral'

export interface Campaign {
  id: string
  workspace_id: string
  ad_account_id: string | null
  platform: AdPlatform
  external_id: string | null
  name: string
  utm_campaign: string | null
  objective: string | null
  spend: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Creative {
  id: string
  workspace_id: string
  campaign_id: string
  external_id: string | null
  name: string
  utm_content: string | null
  utm_term: string | null
  thumbnail_url: string | null
  created_at: string
}

// ─── Analytics ───────────────────────────────────────────────
export interface DailyMetrics {
  id: string
  workspace_id: string
  date: string
  new_leads: number
  leads_won: number
  leads_lost: number
  revenue: number
  revenue_won: number
  conversations_started: number
  messages_sent: number
  messages_received: number
  avg_response_time_s: number | null
  revenue_by_channel: Record<string, number>
  revenue_by_campaign: Record<string, number>
  leads_by_source: Record<string, number>
  agent_metrics: Record<string, AgentMetric>
}

export interface AgentMetric {
  agent_id: string
  conversations_handled: number
  messages_sent: number
  avg_response_time_s: number
  leads_closed: number
  revenue: number
}

// ─── ERP Integration ─────────────────────────────────────────
export type ERPEventType = 'sale.created' | 'sale.updated' | 'sale.refunded'

export interface ERPSalePayload {
  sale_id: string
  customer_phone?: string
  customer_email?: string
  customer_name?: string
  erp_customer_id?: string
  total: number
  currency: string
  items: ERPSaleItem[]
  created_at: string
  metadata?: Record<string, unknown>
}

export interface ERPSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface ERPWebhookEvent {
  event_id: string
  event_type: ERPEventType
  timestamp: string
  payload: ERPSalePayload
}

// ─── Send Message Request ────────────────────────────────────
export interface SendMessageRequest {
  conversation_id: string
  type: MessageType
  content?: string
  media_url?: string
  template_name?: string
  template_vars?: Record<string, string>
}

// ─── Lead Score Input ────────────────────────────────────────
export interface LeadScoreFactors {
  has_phone: boolean
  has_email: boolean
  purchase_count: number
  total_revenue: number
  days_since_last_message: number | null
  days_since_created: number
  campaign_source: boolean
  ctwa_clid: boolean
  messages_count: number
  stage_position: number
  max_stage_position: number
}
