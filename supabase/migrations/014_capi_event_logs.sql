-- ============================================================
-- Migration 014: CAPI Event Audit Log
-- Full audit trail: every attempt to send a CAPI event is logged.
-- ============================================================

CREATE TABLE IF NOT EXISTS capi_queue.event_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES capi_queue.events(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  event_name   TEXT NOT NULL,
  attempt      INT  NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  http_status  INT,
  response     JSONB,
  error        TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event
  ON capi_queue.event_logs(event_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_workspace
  ON capi_queue.event_logs(workspace_id, attempted_at DESC);

-- ─── Grants ─────────────────────────────────────────────────
GRANT SELECT ON capi_queue.event_logs TO authenticated;
GRANT ALL    ON capi_queue.event_logs TO service_role;
