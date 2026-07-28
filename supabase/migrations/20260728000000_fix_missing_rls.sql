-- Habilita RLS y políticas authenticated-only en tablas que quedaron
-- sin protección al momento de su creación.

-- service_month_entries (creada en 20260527000000 sin RLS)
alter table public.service_month_entries enable row level security;

create policy "authenticated_all_service_month_entries"
  on public.service_month_entries
  for all to authenticated
  using (true)
  with check (true);

-- project_templates (creada en 20260714000000 sin RLS)
alter table public.project_templates enable row level security;

create policy "authenticated_all_project_templates"
  on public.project_templates
  for all to authenticated
  using (true)
  with check (true);

-- sub_clients: tenía RLS pero la policy no restringía a authenticated,
-- quedando accesible al rol anon.
drop policy if exists "sub_clients full access" on public.sub_clients;

create policy "authenticated_all_sub_clients"
  on public.sub_clients
  for all to authenticated
  using (true)
  with check (true);
