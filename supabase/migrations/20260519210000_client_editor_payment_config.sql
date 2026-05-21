-- =========================================================================
-- Fase 2 del modelo de pago de editores: config por par cliente-editor.
--
-- Cada par en client_editors puede tener su propia payment_type + rate +
-- flat_amount, y para flat_variable, sus propios tramos en la tabla
-- client_editor_payment_tiers. Si el par no define payment_type, se usa el
-- modelo global del editor como default.
--
-- El override por proyecto (project_editors.cost) sigue ganando sobre todo.
-- =========================================================================

alter table public.client_editors
  add column if not exists payment_type public.editor_payment_model,
  add column if not exists rate numeric,
  add column if not exists flat_amount numeric;

alter table public.client_editors
  add constraint client_editors_rate_nonneg
  check (rate is null or rate >= 0);

alter table public.client_editors
  add constraint client_editors_flat_amount_nonneg
  check (flat_amount is null or flat_amount >= 0);

create table public.client_editor_payment_tiers (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  editor_id   uuid not null references public.editors(id) on delete cascade,
  min_minutes numeric not null check (min_minutes >= 0),
  max_minutes numeric not null,
  amount      numeric not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  constraint client_editor_payment_tiers_range check (max_minutes > min_minutes),
  constraint client_editor_payment_tiers_pair_fkey
    foreign key (client_id, editor_id)
    references public.client_editors(client_id, editor_id)
    on delete cascade
);

create index client_editor_payment_tiers_pair_idx
  on public.client_editor_payment_tiers(client_id, editor_id);

alter table public.client_editor_payment_tiers enable row level security;

create policy "authenticated_all_client_editor_payment_tiers"
  on public.client_editor_payment_tiers
  for all to authenticated
  using (true)
  with check (true);
