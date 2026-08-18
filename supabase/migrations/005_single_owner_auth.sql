-- Require a signed-in, explicitly configured owner for every application table.
-- Existing providers and sessions remain in place; this migration only closes
-- anonymous access and adds the one row that owns the app.

alter table public.providers
  add column if not exists archived boolean not null default false,
  add column if not exists sort_order integer not null default 0;

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  budget_cap numeric(8,2) not null default 50,
  theme text not null default 'light',
  style text not null default 'classic',
  density text not null default 'comfortable',
  vehicle_efficiency numeric(6,2) not null default 14.2,
  petrol_price numeric(6,3) not null default 1.85,
  petrol_use numeric(6,2) not null default 7,
  vehicle_photo_path text,
  updated_at timestamptz not null default now()
);

-- On an existing personal project, the oldest Auth user becomes the owner. If
-- there is no Auth user yet, create one in Supabase Auth and run the documented
-- owner-binding statement before deploying this client.
insert into public.app_settings (id, owner_id)
select 1, id
from auth.users
order by created_at asc
limit 1
on conflict (id) do nothing;

create or replace function public.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_settings
    where id = 1 and owner_id = auth.uid()
  );
$$;

revoke all on function public.is_app_owner() from public;
grant execute on function public.is_app_owner() to authenticated;

alter table public.app_settings enable row level security;
alter table public.providers enable row level security;
alter table public.charging_sessions enable row level security;
alter view public.daily_free_energy set (security_invoker = true);

drop policy if exists "anon read providers" on public.providers;
drop policy if exists "anon write providers" on public.providers;
drop policy if exists "anon update providers" on public.providers;
drop policy if exists "anon delete providers" on public.providers;
drop policy if exists "owner providers" on public.providers;

drop policy if exists "anon read sessions" on public.charging_sessions;
drop policy if exists "anon write sessions" on public.charging_sessions;
drop policy if exists "anon update sessions" on public.charging_sessions;
drop policy if exists "anon delete sessions" on public.charging_sessions;
drop policy if exists "owner sessions" on public.charging_sessions;

drop policy if exists "owner settings" on public.app_settings;

create policy "owner settings"
on public.app_settings
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner providers"
on public.providers
for all
to authenticated
using (public.is_app_owner())
with check (public.is_app_owner());

create policy "owner sessions"
on public.charging_sessions
for all
to authenticated
using (public.is_app_owner())
with check (public.is_app_owner());

revoke all on table public.app_settings from anon;
revoke all on table public.providers from anon;
revoke all on table public.charging_sessions from anon;
revoke all on table public.daily_free_energy from anon;

revoke all on table public.app_settings from authenticated;
revoke all on table public.providers from authenticated;
revoke all on table public.charging_sessions from authenticated;
revoke all on table public.daily_free_energy from authenticated;
grant select, update on table public.app_settings to authenticated;
grant select, insert, update on table public.providers to authenticated;
grant select, insert, update, delete on table public.charging_sessions to authenticated;
grant select on table public.daily_free_energy to authenticated;

-- Private object storage. Objects are kept under <owner UUID>/vehicle.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owner vehicle photos select" on storage.objects;
drop policy if exists "owner vehicle photos insert" on storage.objects;
drop policy if exists "owner vehicle photos update" on storage.objects;
drop policy if exists "owner vehicle photos delete" on storage.objects;

create policy "owner vehicle photos select"
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-photos'
  and public.is_app_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owner vehicle photos insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-photos'
  and public.is_app_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owner vehicle photos update"
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-photos'
  and public.is_app_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-photos'
  and public.is_app_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owner vehicle photos delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-photos'
  and public.is_app_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);
