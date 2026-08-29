-- Rename the charger network in place so existing sessions retain their
-- provider_id and display as Tesla throughout history and detail views.
update public.providers
set name = 'Tesla'
where name = 'Supercharger';
