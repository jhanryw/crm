-- ============================================================
-- Migration 007: Seed default pipeline stages
-- These are defaults; each workspace can customize them.
-- ============================================================

-- This is a template function — called for new workspaces
CREATE OR REPLACE FUNCTION crm.seed_default_pipeline(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO crm.pipeline_stages (workspace_id, name, color, position, is_won, is_lost)
  VALUES
    (p_workspace_id, 'Novo Lead',       '#6366f1', 0, FALSE, FALSE),
    (p_workspace_id, 'Em Contato',      '#3b82f6', 1, FALSE, FALSE),
    (p_workspace_id, 'Qualificado',     '#f59e0b', 2, FALSE, FALSE),
    (p_workspace_id, 'Proposta Enviada','#8b5cf6', 3, FALSE, FALSE),
    (p_workspace_id, 'Negociação',      '#ec4899', 4, FALSE, FALSE),
    (p_workspace_id, 'Ganho',           '#10b981', 5, TRUE,  FALSE),
    (p_workspace_id, 'Perdido',         '#ef4444', 6, FALSE, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-seed when workspace is created
CREATE OR REPLACE FUNCTION crm.on_workspace_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM crm.seed_default_pipeline(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER workspace_created_seed_pipeline
  AFTER INSERT ON crm.workspaces
  FOR EACH ROW EXECUTE FUNCTION crm.on_workspace_created();
