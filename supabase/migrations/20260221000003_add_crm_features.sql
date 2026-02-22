-- Add pending status to conversation_status
ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'pending';

-- Integrations table for WhatsApp and Instagram
CREATE TABLE integrations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  channel channel_type not null,
  status text not null default 'disconnected', -- disconnected, connecting, connected
  config jsonb default '{}'::jsonb, -- Store credentials or session data
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(organization_id, channel)
);

CREATE INDEX integrations_org_idx ON integrations(organization_id);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's integrations"
  ON integrations FOR SELECT
  USING (organization_id = get_current_user_org_id());

CREATE POLICY "Admins/Managers can manage integrations"
  ON integrations FOR ALL
  USING (organization_id = get_current_user_org_id() and EXISTS (select 1 from users where logto_id = auth.jwt() ->> 'sub' and role in ('admin', 'manager')));

-- Origins configuration
CREATE TABLE lead_origins (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  auto_match_regex text, -- For automatic attribution from messages
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE INDEX lead_origins_org_idx ON lead_origins(organization_id);

ALTER TABLE lead_origins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read origins"
  ON lead_origins FOR SELECT
  USING (organization_id = get_current_user_org_id());

CREATE POLICY "Admins/Managers can manage origins"
  ON lead_origins FOR ALL
  USING (organization_id = get_current_user_org_id() and EXISTS (select 1 from users where logto_id = auth.jwt() ->> 'sub' and role in ('admin', 'manager')));

-- Default Origins Trigger
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

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS on_organization_created_add_origins ON organizations;
CREATE TRIGGER on_organization_created_add_origins
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_origins();

-- Update Leads table to have origin
ALTER TABLE leads ADD COLUMN origin_id uuid references lead_origins(id);

-- Update conversations to also have an origin initially guessed
ALTER TABLE inbox_conversations ADD COLUMN origin_id uuid references lead_origins(id);
