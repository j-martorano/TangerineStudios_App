-- =========================================================================
-- payment_methods: catálogo global de métodos de cobro/pago (ej. Binance,
-- DolarApp, cuenta de banco). Compartido para que no se repitan tipos.
--
-- editor_payment_methods: pivot editor ↔ método, con la info concreta que
-- guarda Joaco para ESE editor en ESE método (alias, CBU, usuario, etc.).
--
-- Reemplaza la columna libre `editors.bank_info`.
-- =========================================================================

create table public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.editor_payment_methods (
  editor_id  uuid not null references public.editors(id) on delete cascade,
  method_id  uuid not null references public.payment_methods(id) on delete cascade,
  info       text,
  created_at timestamptz not null default now(),
  primary key (editor_id, method_id)
);

create index editor_payment_methods_editor_idx
  on public.editor_payment_methods(editor_id);

alter table public.payment_methods        enable row level security;
alter table public.editor_payment_methods enable row level security;

create policy "authenticated_all_payment_methods"
  on public.payment_methods
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_editor_payment_methods"
  on public.editor_payment_methods
  for all to authenticated
  using (true)
  with check (true);

-- La info bancaria ahora vive en editor_payment_methods.
alter table public.editors drop column if exists bank_info;
