-- ============================================================
-- Migration 011: crm.lead_notes — structured notes on leads
-- (Separate from the legacy `leads.notes` text field)
-- ============================================================

CREATE TABLE crm.lead_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead_id      ON crm.lead_notes(lead_id);
CREATE INDEX idx_lead_notes_workspace_id ON crm.lead_notes(workspace_id);

CREATE TRIGGER set_lead_notes_updated_at
  BEFORE UPDATE ON crm.lead_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_notes_select" ON crm.lead_notes
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "lead_notes_insert" ON crm.lead_notes
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "lead_notes_update" ON crm.lead_notes
  FOR UPDATE USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "lead_notes_delete" ON crm.lead_notes
  FOR DELETE USING (workspace_id = ANY(crm.get_user_workspace_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON crm.lead_notes TO authenticated;
GRANT ALL ON crm.lead_notes TO service_role;
