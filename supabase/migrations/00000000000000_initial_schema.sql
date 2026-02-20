-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ORGANIZATIONS
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- USERS
create type user_role as enum ('admin', 'manager', 'salesperson');

create table users (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  role user_role not null default 'salesperson',
  email text not null,
  logto_id text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index users_organization_id_idx on users(organization_id);

-- INBOX_CONVERSATIONS
create type channel_type as enum ('whatsapp', 'instagram');
create type conversation_status as enum ('active', 'archived'); -- Asume basic status for now

create table inbox_conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  channel channel_type not null,
  contact_id text not null, -- Phone number or IG handle/ID
  assigned_to uuid references users(id),
  status conversation_status not null default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index inbox_conversations_organization_id_idx on inbox_conversations(organization_id);
create index inbox_conversations_assigned_to_idx on inbox_conversations(assigned_to);

-- CAMPAIGNS
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  channel text not null, -- e.g. 'meta_ads', 'google_ads'
  meta_campaign_id text,
  google_campaign_id text,
  tracking_code text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index campaigns_organization_id_idx on campaigns(organization_id);
create index campaigns_tracking_code_idx on campaigns(tracking_code);

-- STAGES
create table stages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  order_index integer not null,
  probability integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index stages_organization_id_idx on stages(organization_id);

-- LEADS
create table leads (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  source text not null,
  campaign_id uuid references campaigns(id),
  assigned_to uuid references users(id),
  stage_id uuid references stages(id),
  value numeric(10,2) default 0,
  contact_name text,
  contact_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index leads_organization_id_idx on leads(organization_id);
create index leads_campaign_id_idx on leads(campaign_id);
create index leads_assigned_to_idx on leads(assigned_to);
create index leads_stage_id_idx on leads(stage_id);

-- MESSAGES
create type message_direction as enum ('in', 'out');

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references inbox_conversations(id) not null,
  organization_id uuid references organizations(id) not null, -- duplicate for RLS ease
  direction message_direction not null,
  body text,
  campaign_id uuid references campaigns(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index messages_conversation_id_idx on messages(conversation_id);
create index messages_organization_id_idx on messages(organization_id);

-- DEALS_HISTORY
create table deals_history (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) not null,
  organization_id uuid references organizations(id) not null, -- duplicate for RLS ease
  old_stage uuid references stages(id),
  new_stage uuid references stages(id) not null,
  moved_at timestamp with time zone default timezone('utc'::text, now()) not null,
  moved_by uuid references users(id) -- who moved it
);

create index deals_history_lead_id_idx on deals_history(lead_id);
create index deals_history_organization_id_idx on deals_history(organization_id);

-- WEBHOOKS
create table webhooks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  origin text not null, -- site, lp, meta_ads, etc.
  token text not null unique,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index webhooks_organization_id_idx on webhooks(organization_id);
create index webhooks_token_idx on webhooks(token);

-- RESPONSE_TIMES
create table response_times (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references inbox_conversations(id) not null,
  organization_id uuid references organizations(id) not null, -- duplicate for RLS
  first_response_seconds integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index response_times_conversation_id_idx on response_times(conversation_id);


-- RLS POLICIES
-- NOTE: For this initial setup, we are assuming the authenticated user has a claim 'organization_id' in their JWT
-- OR we look up the user in the 'users' table based on auth.uid() (provided by Supabase Auth which maps to Logto ID conceptually, 
-- but since we use Logto for Auth, we might need a custom claim or a lookup function).

-- For simplicity and strict adherence to typical Supabase + External Auth patterns:
-- We will assume the application sets a custom claim or we use a lookup function.
-- Let's create a helper function to get current user's organization_id.

create or replace function get_current_user_org_id()
returns uuid
language sql stable
as $$
  select organization_id 
  from users 
  where logto_id = auth.jwt() ->> 'sub' -- Assuming Logto sub is used as the ID
  limit 1;
$$;

-- ENABLE RLS
alter table organizations enable row level security;
alter table users enable row level security;
alter table inbox_conversations enable row level security;
alter table campaigns enable row level security;
alter table stages enable row level security;
alter table leads enable row level security;
alter table messages enable row level security;
alter table deals_history enable row level security;
alter table webhooks enable row level security;
alter table response_times enable row level security;

-- POLICIES (Read/Write access only for own organization)

-- Organizations
create policy "Users can view their own organization"
  on organizations for select
  using (id = get_current_user_org_id());

-- Users
create policy "Users can view members of their organization"
  on users for select
  using (organization_id = get_current_user_org_id());

-- Inbox Conversations
create policy "Users can view conversations of their organization"
  on inbox_conversations for select
  using (organization_id = get_current_user_org_id());

create policy "Users can insert conversations for their organization"
  on inbox_conversations for insert
  with check (organization_id = get_current_user_org_id());

create policy "Users can update conversations of their organization"
  on inbox_conversations for update
  using (organization_id = get_current_user_org_id());

-- Campaigns
create policy "Users can view campaigns of their organization"
  on campaigns for select
  using (organization_id = get_current_user_org_id());

create policy "Admins/Managers can manage campaigns"
  on campaigns for all
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') in ('admin', 'manager'));

-- Stages
create policy "Users can view stages of their organization"
  on stages for select
  using (organization_id = get_current_user_org_id());

create policy "Admins/Managers can manage stages"
  on stages for all
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') in ('admin', 'manager'));

-- Leads
create policy "Managers/Admins view all leads"
  on leads for select
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') in ('admin', 'manager'));

create policy "Salespersons view assigned leads"
  on leads for select
  using (organization_id = get_current_user_org_id() and assigned_to = (select id from users where logto_id = auth.jwt() ->> 'sub'));

create policy "Users can insert leads for their organization"
  on leads for insert
  with check (organization_id = get_current_user_org_id());

create policy "Users can update leads of their organization"
  on leads for update
  using (organization_id = get_current_user_org_id());

-- Messages
create policy "Users can view messages of their organization"
  on messages for select
  using (organization_id = get_current_user_org_id());

create policy "Users can insert messages for their organization"
  on messages for insert
  with check (organization_id = get_current_user_org_id());

-- Webhooks
create policy "Users can view webhooks of their organization"
  on webhooks for select
  using (organization_id = get_current_user_org_id());

create policy "Admins can manage webhooks"
  on webhooks for all
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') = 'admin');

