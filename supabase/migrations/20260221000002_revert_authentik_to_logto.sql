-- Revert authentik_id back to logto_id in users table
alter table users rename column authentik_id to logto_id;

-- Update helper function to use logto_id
create or replace function get_current_user_org_id()
returns uuid
language sql stable
as $$
  select organization_id 
  from users 
  where logto_id = auth.jwt() ->> 'sub'
  limit 1;
$$;

-- Update RLS policies back to logto_id

drop policy "Admins/Managers can manage campaigns" on campaigns;
create policy "Admins/Managers can manage campaigns"
  on campaigns for all
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') in ('admin', 'manager'));

drop policy "Admins/Managers can manage stages" on stages;
create policy "Admins/Managers can manage stages"
  on stages for all
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') in ('admin', 'manager'));

drop policy "Managers/Admins view all leads" on leads;
create policy "Managers/Admins view all leads"
  on leads for select
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') in ('admin', 'manager'));

drop policy "Salespersons view assigned leads" on leads;
create policy "Salespersons view assigned leads"
  on leads for select
  using (organization_id = get_current_user_org_id() and assigned_to = (select id from users where logto_id = auth.jwt() ->> 'sub'));

drop policy "Admins can manage webhooks" on webhooks;
create policy "Admins can manage webhooks"
  on webhooks for all
  using (organization_id = get_current_user_org_id() and (select role from users where logto_id = auth.jwt() ->> 'sub') = 'admin');
