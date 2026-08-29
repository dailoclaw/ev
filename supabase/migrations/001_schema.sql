-- EV Command — Cockpit Ledger schema
-- providers: charger networks, with per-day free allowance (data, not code)
create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null,
  free_kwh_per_day numeric(6,2) not null default 0,
  created_at timestamptz not null default now()
);

-- charging_sessions: every charge (and membership-fee rows, which have amount = 0)
create table if not exists charging_sessions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id),
  date date not null,
  amount numeric(8,3) not null default 0,   -- kWh (0 for membership-fee rows)
  cost numeric(8,2) not null default 0,     -- AUD
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_date on charging_sessions (date desc);
create index if not exists idx_sessions_provider on charging_sessions (provider_id);

-- derived: free energy actually claimed per provider per day
create or replace view daily_free_energy as
select
  s.provider_id,
  s.date,
  least(p.free_kwh_per_day, sum(s.amount)) as free_kwh
from charging_sessions s
join providers p on p.id = s.provider_id
where p.free_kwh_per_day > 0
group by s.provider_id, s.date, p.free_kwh_per_day;

-- seed the four known networks (free allowance: Jolt 7 kWh/day)
insert into providers (name, color, free_kwh_per_day) values
  ('Jolt', '#0d9488', 7),
  ('Matty', '#6366f1', 0),
  ('Chargefox', '#8b5cf6', 0),
  ('Tesla', '#f43f5e', 0)
on conflict (name) do nothing;
