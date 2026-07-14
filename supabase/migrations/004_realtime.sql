-- Enable realtime change events for the app's tables
alter publication supabase_realtime add table public.charging_sessions;
alter publication supabase_realtime add table public.providers;
