-- ============================================================
-- Migration 012: crm.alerts — system-generated operational alerts
-- Used by temperature-worker and future automations.
-- ============================================================

CREATE TABLE crm.alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES crm.leads(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
                -- 'hot_no_reply'   — hot lead with no reply > 2h
                -- 'stale_lead'     — open lead inactive > N days
                -- 'returning_customer' — past buyer opened new convo
                -- 'score_drop'     — lead score dropped significantly
  severity      TEXT NOT NULL DEFAULT 'warning'
                  CHECK (severity IN ('info', 'warning', 'critical')),
  title         TEXT NOT NULL,
  body          TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_workspace_id ON crm.alerts(workspace_id);
CREATE INDEX idx_alerts_lead_id      ON crm.alerts(lead_id);
CREATE INDEX idx_alerts_unread       ON crm.alerts(workspace_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE crm.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select" ON crm.alerts
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "alerts_update" ON crm.alerts
  FOR UPDATE USING (workspace_id = ANY(crm.get_user_workspace_ids()));

-- Only service_role inserts alerts (workers)
GRANT SELECT, UPDATE ON crm.alerts TO authenticated;
GRANT ALL ON crm.alerts TO service_role;
