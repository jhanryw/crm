-- ============================================================
-- Migration 015: Contact Merge Tracking
-- Records which contacts were merged and how.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.contact_merges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  winner_id       UUID NOT NULL REFERENCES crm.contacts(id) ON DELETE CASCADE,
  loser_id        UUID NOT NULL,   -- kept for audit even after contact deletion
  merged_by       UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  merge_reason    TEXT,
  snapshot_before JSONB,           -- full loser contact snapshot at time of merge
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_merges_workspace
  ON crm.contact_merges(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_merges_winner
  ON crm.contact_merges(winner_id);

-- ─── Grants ─────────────────────────────────────────────────
GRANT SELECT, INSERT ON crm.contact_merges TO authenticated;
GRANT ALL            ON crm.contact_merges TO service_role;
