-- ============================================================
-- Migration 008: Fix infinite recursion in workspace_members RLS
--
-- Root cause: "members_manage" was FOR ALL (includes SELECT).
-- PostgreSQL ORs all SELECT policies, so the subquery inside
-- members_manage re-hit workspace_members → infinite recursion.
--
-- Fix: drop FOR ALL policy and replace with explicit
-- INSERT / UPDATE / DELETE policies. SELECT stays covered by
-- the non-recursive "members_select" (user_id = auth.uid()).
-- ============================================================

DROP POLICY IF EXISTS "members_manage" ON crm.workspace_members;

CREATE POLICY "members_insert" ON crm.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM crm.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.is_active = TRUE
    )
  );

CREATE POLICY "members_update" ON crm.workspace_members
  FOR UPDATE USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM crm.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.is_active = TRUE
    )
  );

CREATE POLICY "members_delete" ON crm.workspace_members
  FOR DELETE USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM crm.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.is_active = TRUE
    )
  );
