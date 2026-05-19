-- =========================================================================
-- fixed_services: servicios fijos / suscripciones mensuales (ej. Adobe CC,
-- almacenamiento, dominios). El costo mensual se resta de la ganancia de
-- cada mes en Finanzas.
-- =========================================================================

create table public.fixed_services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  monthly_cost numeric not null default 0 check (monthly_cost >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.fixed_services enable row level security;

create policy "authenticated_all_fixed_services"
  on public.fixed_services
  for all to authenticated
  using (true)
  with check (true);
