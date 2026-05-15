-- =========================================================================
-- Habilita Row Level Security en todas las tablas de la app + policies
-- "authenticated puede todo" (workspace compartido Erik + Joaco).
-- Los anónimos quedan bloqueados de raíz.
-- =========================================================================

-- Habilitar RLS
alter table public.projects        enable row level security;
alter table public.clients         enable row level security;
alter table public.editors         enable row level security;
alter table public.client_editors  enable row level security;
alter table public.project_editors enable row level security;
alter table public.monthly_settlements enable row level security;

-- Policies: authenticated (cualquier usuario logueado) tiene acceso total.
create policy "authenticated_all_projects"
  on public.projects
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_clients"
  on public.clients
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_editors"
  on public.editors
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_client_editors"
  on public.client_editors
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_project_editors"
  on public.project_editors
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_monthly_settlements"
  on public.monthly_settlements
  for all to authenticated
  using (true)
  with check (true);
