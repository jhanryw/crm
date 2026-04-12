-- ============================================================
-- Migration 005: Analytics + CAPI Queue Schemas
-- ============================================================

-- ─── Daily Metrics (materialized snapshots) ─────────────────
CREATE TABLE analytics.daily_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  -- Leads
  new_leads       INT NOT NULL DEFAULT 0,
  leads_won       INT NOT NULL DEFAULT 0,
  leads_lost      INT NOT NULL DEFAULT 0,
  -- Revenue
  revenue         NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue_won     NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Conversations
  conversations_started INT NOT NULL DEFAULT 0,
  messages_sent   INT NOT NULL DEFAULT 0,
  messages_received INT NOT NULL DEFAULT 0,
  -- Response time (seconds)
  avg_response_time_s INT,
  -- Attribution breakdown (stored as JSONB for flexibility)
  revenue_by_channel  JSONB NOT NULL DEFAULT '{}',
  revenue_by_campaign JSONB NOT NULL DEFAULT '{}',
  leads_by_source     JSONB NOT NULL DEFAULT '{}',
  -- Agent performance
  agent_metrics   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);

CREATE INDEX idx_daily_metrics_workspace ON analytics.daily_metrics(workspace_id, date DESC);

CREATE TRIGGER daily_metrics_updated_at
  BEFORE UPDATE ON analytics.daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Campaign Revenue Attribution ───────────────────────────
CREATE TABLE analytics.campaign_revenue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES attribution.campaigns(id) ON DELETE SET NULL,
  creative_id     UUID REFERENCES attribution.creatives(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  leads_count     INT NOT NULL DEFAULT 0,
  conversions     INT NOT NULL DEFAULT 0,
  revenue         NUMERIC(12,2) NOT NULL DEFAULT 0,
  spend           NUMERIC(12,2) NOT NULL DEFAULT 0,
  roas            NUMERIC(8,4) GENERATED ALWAYS AS (
    CASE WHEN spend > 0 THEN revenue / spend ELSE 0 END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, campaign_id, creative_id, date)
);

CREATE INDEX idx_campaign_revenue_workspace ON analytics.campaign_revenue(workspace_id, date DESC);

-- ─── CAPI Event Queue ────────────────────────────────────────
-- Events are queued here, then flushed to Meta/Google by a worker.
-- Ensures retry logic and deduplication.
CREATE TABLE capi_queue.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('meta','google')),
  event_name      TEXT NOT NULL,    -- Purchase | Lead | InitiateCheckout | Contact
  event_id        TEXT NOT NULL,    -- unique ID for deduplication
  contact_id      UUID REFERENCES crm.contacts(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES crm.leads(id) ON DELETE SET NULL,
  -- Event data
  payload         JSONB NOT NULL,   -- full event payload
  -- Processing
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts        INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  response        JSONB,
  error           TEXT,
  -- Scheduling
  send_after      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, event_id)  -- deduplication by platform + event_id
);

CREATE INDEX idx_capi_events_pending ON capi_queue.events(workspace_id, status, send_after)
  WHERE status = 'pending';
CREATE INDEX idx_capi_events_workspace ON capi_queue.events(workspace_id, created_at DESC);
