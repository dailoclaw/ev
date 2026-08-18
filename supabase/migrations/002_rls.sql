-- Open access model (user's choice): RLS enabled with anon read/write.
-- The anon key ships in the app bundle; data is a personal, non-sensitive ledger.
alter table providers enable row level security;
alter table charging_sessions enable row level security;

drop policy if exists "anon read providers" on providers;
drop policy if exists "anon write providers" on providers;
drop policy if exists "anon update providers" on providers;
drop policy if exists "anon read sessions" on charging_sessions;
drop policy if exists "anon write sessions" on charging_sessions;
drop policy if exists "anon update sessions" on charging_sessions;
drop policy if exists "anon delete sessions" on charging_sessions;

create policy "anon read providers" on providers for select using (true);
create policy "anon write providers" on providers for insert with check (true);
create policy "anon update providers" on providers for update using (true) with check (true);

create policy "anon read sessions" on charging_sessions for select using (true);
create policy "anon write sessions" on charging_sessions for insert with check (true);
create policy "anon update sessions" on charging_sessions for update using (true) with check (true);
create policy "anon delete sessions" on charging_sessions for delete using (true);
