-- Enable realtime change events for the app's tables, safely on both fresh and
-- already-provisioned personal projects.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'charging_sessions'
  ) then
    alter publication supabase_realtime add table public.charging_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'providers'
  ) then
    alter publication supabase_realtime add table public.providers;
  end if;
end $$;
