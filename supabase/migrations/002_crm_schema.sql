-- ============================================================
-- Migration 002: CRM Schema — Contacts, Leads, Pipeline
-- ============================================================

-- ─── Workspaces ─────────────────────────────────────────────
CREATE TABLE crm.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter', -- starter | growth | enterprise
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON crm.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Workspace Members ──────────────────────────────────────
CREATE TABLE crm.workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'agent', -- owner | admin | manager | agent
  display_name  TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace ON crm.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON crm.workspace_members(user_id);

CREATE TRIGGER workspace_members_updated_at
  BEFORE UPDATE ON crm.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Contacts ───────────────────────────────────────────────
CREATE TABLE crm.contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  -- Identity
  name            TEXT,
  phone           TEXT,          -- E.164 format: +5511999999999
  email           TEXT,
  instagram_id    TEXT,          -- Instagram user ID
  whatsapp_id     TEXT,          -- WhatsApp contact ID (phone number)
  -- ERP link (loose coupling — just stores the ERP customer ID)
  erp_customer_id TEXT,
  -- Profile
  avatar_url      TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  custom_fields   JSONB NOT NULL DEFAULT '{}',
  -- Analytics
  total_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_count  INT NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, phone),
  UNIQUE(workspace_id, instagram_id)
);

CREATE INDEX idx_contacts_workspace ON crm.contacts(workspace_id);
CREATE INDEX idx_contacts_phone ON crm.contacts(workspace_id, phone);
CREATE INDEX idx_contacts_erp ON crm.contacts(erp_customer_id);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON crm.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Pipeline Stages ────────────────────────────────────────
CREATE TABLE crm.pipeline_stages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  position      INT NOT NULL DEFAULT 0,
  is_won        BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stages_workspace ON crm.pipeline_stages(workspace_id, position);

-- ─── Leads ──────────────────────────────────────────────────
CREATE TABLE crm.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES crm.contacts(id) ON DELETE CASCADE,
  stage_id        UUID REFERENCES crm.pipeline_stages(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  -- Lead metadata
  title           TEXT NOT NULL DEFAULT 'Novo Lead',
  value           NUMERIC(12,2),          -- expected deal value
  currency        TEXT NOT NULL DEFAULT 'BRL',
  -- Scoring & intelligence
  score           INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  temperature     TEXT NOT NULL DEFAULT 'cold' CHECK (temperature IN ('cold','warm','hot','burning')),
  next_action     TEXT,
  next_action_at  TIMESTAMPTZ,
  -- Attribution (populated from attribution schema)
  source          TEXT,                   -- organic | whatsapp | instagram | paid | referral
  medium          TEXT,                   -- cpc | social | direct | email
  campaign_id     UUID,                   -- FK to attribution.campaigns
  creative_id     UUID,                   -- FK to attribution.creatives
  ctwa_clid       TEXT,                   -- WhatsApp Click-to-Chat click ID
  fbclid          TEXT,
  gclid           TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','archived')),
  won_at          TIMESTAMPTZ,
  lost_at         TIMESTAMPTZ,
  lost_reason     TEXT,
  -- Notes
  notes           TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_workspace ON crm.leads(workspace_id);
CREATE INDEX idx_leads_stage ON crm.leads(workspace_id, stage_id);
CREATE INDEX idx_leads_contact ON crm.leads(contact_id);
CREATE INDEX idx_leads_assigned ON crm.leads(assigned_to);
CREATE INDEX idx_leads_status ON crm.leads(workspace_id, status);
CREATE INDEX idx_leads_temperature ON crm.leads(workspace_id, temperature);
CREATE INDEX idx_leads_score ON crm.leads(workspace_id, score DESC);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON crm.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Lead Activities (timeline) ─────────────────────────────
CREATE TABLE crm.lead_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  type          TEXT NOT NULL, -- note | stage_change | assignment | score_update | purchase | message | call
  title         TEXT NOT NULL,
  body          TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_activities_lead ON crm.lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_lead_activities_workspace ON crm.lead_activities(workspace_id, created_at DESC);

-- ─── ERP Sale Events (received via webhook from ERP) ────────
-- Stores the event payload; CRM processes it to update leads.
-- This ensures idempotency — we can replay events safely.
CREATE TABLE crm.erp_sale_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT UNIQUE NOT NULL,  -- ERP-supplied idempotency key
  event_type    TEXT NOT NULL,         -- sale.created | sale.updated | sale.refunded
  payload       JSONB NOT NULL,
  contact_id    UUID REFERENCES crm.contacts(id) ON DELETE SET NULL,
  lead_id       UUID REFERENCES crm.leads(id) ON DELETE SET NULL,
  processed     BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_erp_sale_events_processed ON crm.erp_sale_events(processed, created_at);
CREATE INDEX idx_erp_sale_events_contact ON crm.erp_sale_events(contact_id);
