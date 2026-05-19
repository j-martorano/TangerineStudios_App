-- =========================================================================
-- 1. Multi-editor: N editores por proyecto.
--    Antes el pivot permitía como máximo 2 (PK por rol primary/secondary).
--    Ahora la PK es (project_id, editor_id) y se elimina el concepto de rol.
-- =========================================================================

alter table public.project_editors drop constraint project_editors_pkey;
drop index if exists public.project_editors_role_idx;
alter table public.project_editors drop column role;
alter table public.project_editors add primary key (project_id, editor_id);
drop type if exists public.editor_role;

-- =========================================================================
-- 2. Clientes mensuales: rate por minuto + saldo de minutos.
--    El monto mensual fijo se reemplaza por pagos variables que acreditan
--    minutos. El rate por minuto vive en `agreed_price` (compartido con los
--    clientes por_rate). El saldo de minutos se calcula:
--      minutos acreditados por pagos − minutos consumidos por proyectos.
-- =========================================================================

alter table public.clients
  add column if not exists retainer_discount_pct numeric not null default 10;

alter table public.clients
  add constraint clients_retainer_discount_range
  check (retainer_discount_pct >= 0 and retainer_discount_pct <= 100);

alter table public.clients drop column if exists monthly_fee;
alter table public.clients drop column if exists balance;

-- Pagos de clientes mensuales: cada pago acredita minutos al rate del momento.
create table public.client_payments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  amount           numeric not null check (amount >= 0),
  minutes_credited numeric not null check (minutes_credited >= 0),
  paid_at          date not null default current_date,
  note             text,
  created_at       timestamptz not null default now()
);

create index client_payments_client_idx on public.client_payments(client_id);

alter table public.client_payments enable row level security;

create policy "authenticated_all_client_payments"
  on public.client_payments
  for all to authenticated
  using (true)
  with check (true);
