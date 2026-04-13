-- ============================================================
-- Migration 013: Extended Analytics Tables
-- agent_daily_metrics, creative_daily_metrics
-- ============================================================

-- ─── Agent Daily Metrics ────────────────────────────────────
-- Granular per-agent breakdown extracted from daily_metrics.agent_metrics JSONB.
-- Written by metrics-worker every hour.
CREATE TABLE IF NOT EXISTS analytics.agent_daily_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  agent_id              UUID NOT NULL REFERENCES crm.workspace_members(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  conversations_handled INT  NOT NULL DEFAULT 0,
  messages_sent         INT  NOT NULL DEFAULT 0,
  leads_closed          INT  NOT NULL DEFAULT 0,
  revenue               NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_response_time_s   INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_workspace
  ON analytics.agent_daily_metrics(workspace_id, date DESC);

CREATE TRIGGER agent_daily_metrics_updated_at
  BEFORE UPDATE ON analytics.agent_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Creative Daily Metrics ─────────────────────────────────
-- Per-creative performance aggregated from touch_events + campaign_revenue.
CREATE TABLE IF NOT EXISTS analytics.creative_daily_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  creative_id  UUID NOT NULL REFERENCES attribution.creatives(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  leads_count  INT  NOT NULL DEFAULT 0,
  conversions  INT  NOT NULL DEFAULT 0,
  revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  spend        NUMERIC(12,2) NOT NULL DEFAULT 0,
  roas         NUMERIC(8,4) GENERATED ALWAYS AS (
    CASE WHEN spend > 0 THEN revenue / spend ELSE 0 END
  ) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, creative_id, date)
);

CREATE INDEX IF NOT EXISTS idx_creative_metrics_workspace
  ON analytics.creative_daily_metrics(workspace_id, date DESC);

CREATE TRIGGER creative_daily_metrics_updated_at
  BEFORE UPDATE ON analytics.creative_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Grants ─────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON analytics.agent_daily_metrics   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON analytics.creative_daily_metrics TO authenticated;
GRANT ALL ON analytics.agent_daily_metrics   TO service_role;
GRANT ALL ON analytics.creative_daily_metrics TO service_role;
