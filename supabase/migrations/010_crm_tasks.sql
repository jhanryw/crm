-- ============================================================
-- Migration 010: crm.tasks — lead follow-up tasks
-- ============================================================

CREATE TABLE crm.tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_at        TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_lead_id        ON crm.tasks(lead_id);
CREATE INDEX idx_tasks_workspace_id   ON crm.tasks(workspace_id);
CREATE INDEX idx_tasks_assigned_to    ON crm.tasks(assigned_to);
CREATE INDEX idx_tasks_due_at         ON crm.tasks(due_at) WHERE completed_at IS NULL;

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON crm.tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON crm.tasks
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "tasks_insert" ON crm.tasks
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "tasks_update" ON crm.tasks
  FOR UPDATE USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "tasks_delete" ON crm.tasks
  FOR DELETE USING (workspace_id = ANY(crm.get_user_workspace_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON crm.tasks TO authenticated;
GRANT ALL ON crm.tasks TO service_role;
