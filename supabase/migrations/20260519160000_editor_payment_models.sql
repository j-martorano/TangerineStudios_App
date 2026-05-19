-- =========================================================================
-- Nuevo modelo de pago de editores. Reemplaza el enum viejo ('por_rate',
-- 'mensual') por tres modelos por proyecto:
--
--   - 'flat'          : monto fijo por proyecto (editors.flat_amount).
--   - 'flat_variable' : monto fijo según el rango de minutos en que cae el
--                       video (tabla editor_payment_tiers).
--   - 'por_minuto'    : rate × minutos finales (editors.rate). Antes 'por_rate'.
--
-- Se elimina el tipo 'mensual' de editores y la columna monthly_fee.
-- =========================================================================

create type public.editor_payment_model as enum (
  'flat',
  'flat_variable',
  'por_minuto'
);

-- Convertir la columna al enum nuevo (todo lo viejo cae en 'por_minuto').
alter table public.editors alter column payment_type drop default;

alter table public.editors
  alter column payment_type type public.editor_payment_model
  using 'por_minuto'::public.editor_payment_model;

alter table public.editors
  alter column payment_type set default 'por_minuto';

drop type public.editor_payment_type;

-- monthly_fee de editores ya no se usa (sin tipo mensual).
alter table public.editors drop column if exists monthly_fee;

-- flat_amount: monto fijo por proyecto para editores FLAT.
alter table public.editors add column if not exists flat_amount numeric;
alter table public.editors
  add constraint editors_flat_amount_nonneg
  check (flat_amount is null or flat_amount >= 0);

-- Tramos de FLAT variable: rango de minutos → monto fijo.
create table public.editor_payment_tiers (
  id          uuid primary key default gen_random_uuid(),
  editor_id   uuid not null references public.editors(id) on delete cascade,
  min_minutes numeric not null check (min_minutes >= 0),
  max_minutes numeric not null,
  amount      numeric not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  constraint editor_payment_tiers_range check (max_minutes > min_minutes)
);

create index editor_payment_tiers_editor_idx
  on public.editor_payment_tiers(editor_id);

alter table public.editor_payment_tiers enable row level security;

create policy "authenticated_all_editor_payment_tiers"
  on public.editor_payment_tiers
  for all to authenticated
  using (true)
  with check (true);
