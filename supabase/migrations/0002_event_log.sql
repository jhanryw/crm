-- EVENT LOG
create table event_log (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  event_name text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index event_log_organization_id_idx on event_log(organization_id);
create index event_log_event_name_idx on event_log(event_name);
create index event_log_created_at_idx on event_log(created_at);

-- Enable RLS
alter table event_log enable row level security;

-- Policy: Users can view events of their organization
create policy "Users can view event_log of their organization"
  on event_log for select
  using (organization_id = get_current_user_org_id());

-- Policy: Users can insert events for their organization
create policy "Users can insert event_log for their organization"
  on event_log for insert
  with check (organization_id = get_current_user_org_id());
