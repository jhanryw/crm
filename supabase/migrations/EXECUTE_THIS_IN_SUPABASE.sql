-- ============================================================
-- QARVON CRM — Schema completo (execute este arquivo inteiro
-- no Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor)
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'salesperson');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE channel_type AS ENUM ('whatsapp', 'instagram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('active', 'archived', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. USERS
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  role user_role NOT NULL DEFAULT 'salesperson',
  email text NOT NULL,
  logto_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS users_organization_id_idx ON users(organization_id);

-- 5. INBOX_CONVERSATIONS
CREATE TABLE IF NOT EXISTS inbox_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  channel channel_type NOT NULL,
  contact_id text NOT NULL,
  assigned_to uuid REFERENCES users(id),
  status conversation_status NOT NULL DEFAULT 'active',
  origin_id uuid, -- FK added below after lead_origins exists
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS inbox_conversations_organization_id_idx ON inbox_conversations(organization_id);
CREATE INDEX IF NOT EXISTS inbox_conversations_assigned_to_idx ON inbox_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conv_org_status ON inbox_conversations(organization_id, status);

-- 6. CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  channel text NOT NULL,
  meta_campaign_id text,
  google_campaign_id text,
  tracking_code text UNIQUE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS campaigns_organization_id_idx ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS campaigns_tracking_code_idx ON campaigns(tracking_code);

-- 7. STAGES
CREATE TABLE IF NOT EXISTS stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL,
  probability integer DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS stages_organization_id_idx ON stages(organization_id);

-- 8. LEAD_ORIGINS
CREATE TABLE IF NOT EXISTS lead_origins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  auto_match_regex text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS lead_origins_org_idx ON lead_origins(organization_id);

-- 9. LEADS
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  source text NOT NULL,
  campaign_id uuid REFERENCES campaigns(id),
  assigned_to uuid REFERENCES users(id),
  stage_id uuid REFERENCES stages(id),
  origin_id uuid REFERENCES lead_origins(id),
  value numeric(10,2) DEFAULT 0,
  contact_name text,
  contact_phone text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_organization_id_idx ON leads(organization_id);
CREATE INDEX IF NOT EXISTS leads_campaign_id_idx ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS leads_stage_id_idx ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_stage ON leads(organization_id, stage_id);

-- Now add the FK for inbox_conversations.origin_id (lead_origins already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inbox_conversations_origin_id_fkey'
  ) THEN
    ALTER TABLE inbox_conversations ADD CONSTRAINT inbox_conversations_origin_id_fkey
      FOREIGN KEY (origin_id) REFERENCES lead_origins(id);
  END IF;
END $$;

-- 10. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES inbox_conversations(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  direction message_direction NOT NULL,
  body text,
  campaign_id uuid REFERENCES campaigns(id),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_organization_id_idx ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);

-- 11. DEALS_HISTORY
CREATE TABLE IF NOT EXISTS deals_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid REFERENCES leads(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  old_stage uuid REFERENCES stages(id),
  new_stage uuid REFERENCES stages(id) NOT NULL,
  moved_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  moved_by uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS deals_history_lead_id_idx ON deals_history(lead_id);
CREATE INDEX IF NOT EXISTS deals_history_organization_id_idx ON deals_history(organization_id);

-- 12. WEBHOOKS
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  origin text NOT NULL,
  token text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS webhooks_organization_id_idx ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS webhooks_token_idx ON webhooks(token);

-- 13. RESPONSE_TIMES
CREATE TABLE IF NOT EXISTS response_times (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES inbox_conversations(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  first_response_seconds integer,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS response_times_conversation_id_idx ON response_times(conversation_id);

-- 14. INTEGRATIONS
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  channel channel_type NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(organization_id, channel)
);

CREATE INDEX IF NOT EXISTS integrations_org_idx ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_org_channel ON integrations(organization_id, channel);

-- 15. EVENT_LOG
CREATE TABLE IF NOT EXISTS event_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  event_name text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS event_log_organization_id_idx ON event_log(organization_id);
CREATE INDEX IF NOT EXISTS event_log_event_name_idx ON event_log(event_name);
CREATE INDEX IF NOT EXISTS event_log_created_at_idx ON event_log(created_at);

-- ============================================================
-- RLS HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_user_org_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT organization_id
  FROM users
  WHERE logto_id = auth.jwt() ->> 'sub'
  LIMIT 1;
$$;

-- ============================================================
-- TRIGGER: default origins on org creation
-- ============================================================

CREATE OR REPLACE FUNCTION create_default_origins()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lead_origins (organization_id, name, auto_match_regex)
  VALUES
    (NEW.id, 'WhatsApp Orgânico', NULL),
    (NEW.id, 'Instagram Orgânico', NULL),
    (NEW.id, 'Tráfego Pago (Desconhecido)', NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created_add_origins ON organizations;
CREATE TRIGGER on_organization_created_add_origins
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_origins();

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Organizations
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = get_current_user_org_id());

DROP POLICY IF EXISTS "Service can insert organizations" ON organizations;
CREATE POLICY "Service can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- Users
DROP POLICY IF EXISTS "Users can view members of their organization" ON users;
CREATE POLICY "Users can view members of their organization"
  ON users FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Service can insert users" ON users;
CREATE POLICY "Service can insert users"
  ON users FOR INSERT
  WITH CHECK (true);

-- Inbox Conversations
DROP POLICY IF EXISTS "Users can view conversations of their organization" ON inbox_conversations;
CREATE POLICY "Users can view conversations of their organization"
  ON inbox_conversations FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Users can insert conversations for their organization" ON inbox_conversations;
CREATE POLICY "Users can insert conversations for their organization"
  ON inbox_conversations FOR INSERT
  WITH CHECK (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Users can update conversations of their organization" ON inbox_conversations;
CREATE POLICY "Users can update conversations of their organization"
  ON inbox_conversations FOR UPDATE
  USING (organization_id = get_current_user_org_id());

-- Campaigns
DROP POLICY IF EXISTS "Users can view campaigns of their organization" ON campaigns;
CREATE POLICY "Users can view campaigns of their organization"
  ON campaigns FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins/Managers can manage campaigns" ON campaigns;
CREATE POLICY "Admins/Managers can manage campaigns"
  ON campaigns FOR ALL
  USING (organization_id = get_current_user_org_id() AND (SELECT role FROM users WHERE logto_id = auth.jwt() ->> 'sub') IN ('admin', 'manager'));

-- Stages
DROP POLICY IF EXISTS "Users can view stages of their organization" ON stages;
CREATE POLICY "Users can view stages of their organization"
  ON stages FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins/Managers can manage stages" ON stages;
CREATE POLICY "Admins/Managers can manage stages"
  ON stages FOR ALL
  USING (organization_id = get_current_user_org_id() AND (SELECT role FROM users WHERE logto_id = auth.jwt() ->> 'sub') IN ('admin', 'manager'));

-- Lead Origins
DROP POLICY IF EXISTS "Users can read origins" ON lead_origins;
CREATE POLICY "Users can read origins"
  ON lead_origins FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins/Managers can manage origins" ON lead_origins;
CREATE POLICY "Admins/Managers can manage origins"
  ON lead_origins FOR ALL
  USING (organization_id = get_current_user_org_id() AND EXISTS (
    SELECT 1 FROM users WHERE logto_id = auth.jwt() ->> 'sub' AND role IN ('admin', 'manager')
  ));

-- Leads
DROP POLICY IF EXISTS "Managers/Admins view all leads" ON leads;
CREATE POLICY "Managers/Admins view all leads"
  ON leads FOR SELECT
  USING (organization_id = get_current_user_org_id() AND (SELECT role FROM users WHERE logto_id = auth.jwt() ->> 'sub') IN ('admin', 'manager'));

DROP POLICY IF EXISTS "Salespersons view assigned leads" ON leads;
CREATE POLICY "Salespersons view assigned leads"
  ON leads FOR SELECT
  USING (organization_id = get_current_user_org_id() AND assigned_to = (SELECT id FROM users WHERE logto_id = auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can insert leads for their organization" ON leads;
CREATE POLICY "Users can insert leads for their organization"
  ON leads FOR INSERT
  WITH CHECK (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Users can update leads of their organization" ON leads;
CREATE POLICY "Users can update leads of their organization"
  ON leads FOR UPDATE
  USING (organization_id = get_current_user_org_id());

-- Messages
DROP POLICY IF EXISTS "Users can view messages of their organization" ON messages;
CREATE POLICY "Users can view messages of their organization"
  ON messages FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Users can insert messages for their organization" ON messages;
CREATE POLICY "Users can insert messages for their organization"
  ON messages FOR INSERT
  WITH CHECK (organization_id = get_current_user_org_id());

-- Webhooks
DROP POLICY IF EXISTS "Users can view webhooks of their organization" ON webhooks;
CREATE POLICY "Users can view webhooks of their organization"
  ON webhooks FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins can manage webhooks" ON webhooks;
CREATE POLICY "Admins can manage webhooks"
  ON webhooks FOR ALL
  USING (organization_id = get_current_user_org_id() AND (SELECT role FROM users WHERE logto_id = auth.jwt() ->> 'sub') = 'admin');

-- Integrations
DROP POLICY IF EXISTS "Users can view their organization's integrations" ON integrations;
CREATE POLICY "Users can view their organization's integrations"
  ON integrations FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins/Managers can manage integrations" ON integrations;
CREATE POLICY "Admins/Managers can manage integrations"
  ON integrations FOR ALL
  USING (organization_id = get_current_user_org_id() AND EXISTS (
    SELECT 1 FROM users WHERE logto_id = auth.jwt() ->> 'sub' AND role IN ('admin', 'manager')
  ));

-- Event Log
DROP POLICY IF EXISTS "Users can view event_log of their organization" ON event_log;
CREATE POLICY "Users can view event_log of their organization"
  ON event_log FOR SELECT
  USING (organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Users can insert event_log for their organization" ON event_log;
CREATE POLICY "Users can insert event_log for their organization"
  ON event_log FOR INSERT
  WITH CHECK (organization_id = get_current_user_org_id());
