-- ============================================================
-- Migration 006: Row Level Security Policies
-- All tables use workspace-scoped RLS.
-- service_role bypasses RLS for backend workers.
-- ============================================================

-- ─── Enable RLS ─────────────────────────────────────────────
ALTER TABLE crm.workspaces              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.workspace_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.contacts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.pipeline_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.leads                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.lead_activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.erp_sale_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.quick_replies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution.ad_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution.campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution.creatives       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution.touch_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.daily_metrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.campaign_revenue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE capi_queue.events           ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: get current user's workspace IDs ──────
CREATE OR REPLACE FUNCTION crm.get_user_workspace_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(workspace_id)
  FROM crm.workspace_members
  WHERE user_id = auth.uid() AND is_active = TRUE;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

-- ─── CRM Policies ───────────────────────────────────────────

-- workspaces: members can see their workspaces
CREATE POLICY "workspaces_select" ON crm.workspaces
  FOR SELECT USING (id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "workspaces_update" ON crm.workspaces
  FOR UPDATE USING (
    id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- workspace_members: each user sees only their own memberships (avoids RLS recursion)
CREATE POLICY "members_select" ON crm.workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- Admins manage members of the same workspace
CREATE POLICY "members_manage" ON crm.workspace_members
  FOR ALL USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM crm.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner','admin')
        AND wm.is_active = TRUE
    )
  );

-- contacts: workspace-scoped
CREATE POLICY "contacts_select" ON crm.contacts
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "contacts_insert" ON crm.contacts
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "contacts_update" ON crm.contacts
  FOR UPDATE USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "contacts_delete" ON crm.contacts
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
    )
  );

-- pipeline_stages
CREATE POLICY "stages_select" ON crm.pipeline_stages
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "stages_manage" ON crm.pipeline_stages
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
    )
  );

-- leads: workspace-scoped; agents can see only assigned leads (optional override)
CREATE POLICY "leads_select" ON crm.leads
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "leads_insert" ON crm.leads
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "leads_update" ON crm.leads
  FOR UPDATE USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "leads_delete" ON crm.leads
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
    )
  );

-- lead_activities
CREATE POLICY "activities_select" ON crm.lead_activities
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "activities_insert" ON crm.lead_activities
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));

-- erp_sale_events: read-only for all workspace members
CREATE POLICY "erp_events_select" ON crm.erp_sale_events
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM crm.contacts WHERE workspace_id = ANY(crm.get_user_workspace_ids())
    )
  );

-- ─── Messaging Policies ─────────────────────────────────────

CREATE POLICY "channels_select" ON messaging.channels
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "channels_manage" ON messaging.channels
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

CREATE POLICY "conversations_select" ON messaging.conversations
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "conversations_insert" ON messaging.conversations
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "conversations_update" ON messaging.conversations
  FOR UPDATE USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "messages_select" ON messaging.messages
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "messages_insert" ON messaging.messages
  FOR INSERT WITH CHECK (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "templates_select" ON messaging.templates
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "templates_manage" ON messaging.templates
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
    )
  );

CREATE POLICY "quick_replies_select" ON messaging.quick_replies
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "quick_replies_manage" ON messaging.quick_replies
  FOR ALL USING (workspace_id = ANY(crm.get_user_workspace_ids()));

-- ─── Attribution Policies ────────────────────────────────────
CREATE POLICY "ad_accounts_select" ON attribution.ad_accounts
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "ad_accounts_manage" ON attribution.ad_accounts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM crm.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

CREATE POLICY "campaigns_select" ON attribution.campaigns
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "campaigns_manage" ON attribution.campaigns
  FOR ALL USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "creatives_select" ON attribution.creatives
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));
CREATE POLICY "creatives_manage" ON attribution.creatives
  FOR ALL USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "touch_events_select" ON attribution.touch_events
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));

-- ─── Analytics Policies ──────────────────────────────────────
CREATE POLICY "daily_metrics_select" ON analytics.daily_metrics
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));

CREATE POLICY "campaign_revenue_select" ON analytics.campaign_revenue
  FOR SELECT USING (workspace_id = ANY(crm.get_user_workspace_ids()));

-- ─── CAPI Queue: service_role only ───────────────────────────
-- No authenticated user policies — only the worker (service_role) accesses this
CREATE POLICY "capi_events_deny_anon" ON capi_queue.events
  FOR ALL USING (FALSE);
