-- Guard future writes at the database boundary. These limits are deliberately
-- generous for a personal charging ledger while excluding malformed payloads.

alter table public.providers
  drop constraint if exists providers_free_kwh_range,
  add constraint providers_free_kwh_range check (free_kwh_per_day between 0 and 500),
  drop constraint if exists providers_color_format,
  add constraint providers_color_format check (color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  drop constraint if exists providers_name_not_blank,
  add constraint providers_name_not_blank check (length(btrim(name)) between 1 and 80),
  drop constraint if exists providers_sort_order_range,
  add constraint providers_sort_order_range check (sort_order between 0 and 10000);

create unique index if not exists providers_name_ci_unique
on public.providers (lower(btrim(name)));

alter table public.charging_sessions
  drop constraint if exists sessions_amount_range,
  add constraint sessions_amount_range check (amount between 0 and 10000),
  drop constraint if exists sessions_cost_range,
  add constraint sessions_cost_range check (cost between 0 and 100000),
  drop constraint if exists sessions_has_value,
  add constraint sessions_has_value check (amount > 0 or cost > 0),
  drop constraint if exists sessions_date_range,
  add constraint sessions_date_range check (date between date '2000-01-01' and current_date + 1),
  drop constraint if exists sessions_notes_length,
  add constraint sessions_notes_length check (notes is null or length(notes) <= 1000);

alter table public.app_settings
  drop constraint if exists settings_budget_range,
  add constraint settings_budget_range check (budget_cap between 0 and 100000),
  drop constraint if exists settings_theme_values,
  add constraint settings_theme_values check (theme in ('light', 'dark')),
  drop constraint if exists settings_style_values,
  add constraint settings_style_values check (style in ('classic', 'minimal')),
  drop constraint if exists settings_density_values,
  add constraint settings_density_values check (density in ('comfortable', 'compact', 'presentation')),
  drop constraint if exists settings_vehicle_efficiency_range,
  add constraint settings_vehicle_efficiency_range check (vehicle_efficiency between 1 and 100),
  drop constraint if exists settings_petrol_price_range,
  add constraint settings_petrol_price_range check (petrol_price between 0 and 20),
  drop constraint if exists settings_petrol_use_range,
  add constraint settings_petrol_use_range check (petrol_use between 0 and 100);
