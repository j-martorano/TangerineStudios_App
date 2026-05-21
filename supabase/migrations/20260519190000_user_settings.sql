-- =========================================================================
-- user_settings: preferencias por usuario (Erik / Joaco). Cada usuario tiene
-- su row con sus preferencias guardadas como JSON (columnas visibles,
-- límites de paginación, secciones de Finanzas, etc.).
-- =========================================================================

create table public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Cada usuario lee y modifica solo su propia row.
create policy "user_settings_select_own"
  on public.user_settings
  for select to authenticated
  using (user_id = auth.uid());

create policy "user_settings_insert_own"
  on public.user_settings
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "user_settings_update_own"
  on public.user_settings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
