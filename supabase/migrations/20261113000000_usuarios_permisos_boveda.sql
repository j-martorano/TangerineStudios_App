-- =============================================================================
-- Usuarios, permisos por pestaña y Bóveda de credenciales.
--
-- 1. profiles: rol (admin | member) + pestañas visibles de cada usuario.
-- 2. Permisos por tabla según pestaña: tabs_for(tabla, 'read'|'insert'|'write')
--    dice qué pestañas habilitan leer, crear o editar/borrar cada tabla
--    (apply_tab_policies las aplica a una tabla). Se aplican como
--    policies RESTRICTIVE, así nadie lee ni escribe por la API de Supabase
--    (con su propia sesión) datos de una pestaña que no tiene.
-- 3. Bóveda: credenciales cifradas (AES-256-GCM en el servidor, la DB solo ve
--    texto cifrado), quién ve cada una, log de eventos y avisos.
-- 4. Trigger: al rotar una contraseña se crea un aviso SOLO para los usuarios
--    que tienen acceso a esa credencial.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'member' check (role in ('admin', 'member')),
  allowed_tabs text[] not null default '{}',
  disabled     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario puede leer solo su propio perfil. Nadie escribe con su sesión:
-- crear usuarios y cambiar permisos lo hace el servidor con service role
-- después de verificar que quien lo pide es admin.
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- Los usuarios que ya existen hoy tenían acceso total: quedan como admin para
-- que nadie pierda acceso con este deploy. El admin después baja de rol a quien
-- corresponda desde /usuarios.
insert into public.profiles (id, email, role)
select id, coalesce(email, ''), 'admin'
from auth.users
on conflict (id) do nothing;

-- Usuarios creados por fuera de la app (panel de Supabase) arrancan sin
-- ninguna pestaña.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Permisos por tabla según pestaña
-- ---------------------------------------------------------------------------
-- ¿El usuario logueado es admin o tiene alguna de estas pestañas?
create or replace function public.has_any_tab(tabs text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and not p.disabled
      and (p.role = 'admin' or p.allowed_tabs && tabs)
  );
$$;

-- Qué pestañas habilitan cada operación sobre cada tabla:
--   'read'   → leer
--   'insert' → crear filas (si no se especifica, es igual a 'write')
--   'write'  → editar y borrar
-- Sale de lo que muestra y edita cada pantalla (incluye formularios que una
-- pestaña abre aunque escriban en otra tabla: p. ej. crear un cliente desde
-- el formulario de proyecto, que NO habilita editar ni borrar clientes).
-- Las policies suman: leer = read ∪ insert ∪ write; crear = insert ∪ write.
-- Tabla que no está acá = solo admins.
--
-- ⚠️ Mantener en sincronía con lib/auth/scopes.ts (guards de las actions).
create or replace function public.tabs_for(tbl text, mode text)
returns text[]
language sql
immutable
as $$
  select case
    when tbl in ('projects', 'project_editors', 'project_revisions') then
      case when mode = 'read'
        then array['dashboard', 'kanban', 'projects', 'finanzas', 'facturas', 'mantenimiento']
        else array['dashboard', 'kanban', 'projects', 'finanzas', 'facturas'] end
    -- Mantenimiento (backfill) crea cobros y pagos que faltan.
    when tbl in ('project_cobros', 'project_editor_pagos') then
      array['dashboard', 'kanban', 'projects', 'finanzas', 'facturas', 'mantenimiento']
    when tbl = 'clients' then
      case mode
        when 'read'   then array['dashboard', 'kanban', 'projects', 'clients', 'editors', 'finanzas', 'facturas', 'mantenimiento']
        when 'insert' then array['dashboard', 'kanban', 'projects', 'clients', 'editors']
        else array['clients'] end
    when tbl in ('client_editors', 'client_editor_payment_tiers') then
      case mode
        when 'read'   then array['dashboard', 'kanban', 'projects', 'clients', 'editors', 'finanzas']
        when 'insert' then array['dashboard', 'kanban', 'projects', 'clients', 'editors']
        else array['clients', 'editors'] end
    when tbl in ('editors', 'editor_payment_tiers') then
      case mode
        when 'read'   then array['dashboard', 'kanban', 'projects', 'clients', 'editors', 'finanzas', 'facturas', 'mantenimiento']
        when 'insert' then array['dashboard', 'clients', 'editors']
        else array['editors'] end
    when tbl = 'editor_payment_methods' then
      case mode
        when 'write' then array['editors']
        else array['dashboard', 'clients', 'editors'] end
    when tbl = 'payment_methods' then
      case when mode = 'read'
        then array['dashboard', 'clients', 'editors', 'configuracion']
        else array['editors', 'configuracion'] end
    when tbl = 'client_payments' then
      array['dashboard', 'kanban', 'projects', 'clients', 'finanzas']
    when tbl in ('fixed_services', 'service_month_entries') then
      case when mode = 'read'
        then array['dashboard', 'finanzas', 'configuracion']
        else array['finanzas', 'configuracion'] end
    when tbl = 'monthly_settlements' then
      array['finanzas']
    when tbl in ('invoices', 'invoice_projects') then
      array['kanban', 'facturas']
    when tbl = 'invoice_settings' then
      case when mode = 'read'
        then array['kanban', 'facturas', 'configuracion']
        else array['configuracion'] end
    when tbl in ('project_templates', 'sub_clients') then
      array['dashboard', 'kanban', 'projects', 'clients']
    else '{}'::text[]
  end;
$$;

-- Crea (o recrea) las cuatro policies restrictivas de una tabla. Se suman con
-- AND a las policies que ya tenga la tabla, que siguen igual.
--
-- ⚠️ Toda tabla nueva de public con RLS tiene que llamar a esta función en su
-- migración (`select public.apply_tab_policies('mi_tabla');`). Sin eso, sus
-- policies permisivas valen para cualquier usuario logueado, aunque no tenga
-- ninguna pestaña.
create or replace function public.apply_tab_policies(tbl text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r text := format(
    'public.has_any_tab(public.tabs_for(%1$L, ''read'') || public.tabs_for(%1$L, ''insert'') || public.tabs_for(%1$L, ''write''))',
    tbl);
  i text := format(
    'public.has_any_tab(public.tabs_for(%1$L, ''insert'') || public.tabs_for(%1$L, ''write''))', tbl);
  w text := format('public.has_any_tab(public.tabs_for(%1$L, ''write''))', tbl);
begin
  execute format('drop policy if exists "tab_read" on public.%I', tbl);
  execute format('drop policy if exists "tab_insert" on public.%I', tbl);
  execute format('drop policy if exists "tab_update" on public.%I', tbl);
  execute format('drop policy if exists "tab_delete" on public.%I', tbl);
  execute format('create policy "tab_read" on public.%I as restrictive for select to authenticated using (%s)', tbl, r);
  execute format('create policy "tab_insert" on public.%I as restrictive for insert to authenticated with check (%s)', tbl, i);
  execute format('create policy "tab_update" on public.%I as restrictive for update to authenticated using (%s) with check (%s)', tbl, w, w);
  execute format('create policy "tab_delete" on public.%I as restrictive for delete to authenticated using (%s)', tbl, w);
end;
$$;

revoke execute on function public.apply_tab_policies(text) from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and rowsecurity
      and tablename not in ('profiles', 'user_settings')
  loop
    perform public.apply_tab_policies(t.tablename);
  end loop;
end;
$$;

-- project_revisions tenía una policy pensada para el service role pero creada
-- para todos los roles ("to public" con using true): cualquiera con la anon
-- key (que es pública) podía leer y escribir revisiones. El service role no
-- necesita policies (salta RLS), y la app solo escribe revisiones desde el
-- bot. La reemplazamos por una para usuarios logueados, filtrada por pestaña
-- con las policies de arriba.
drop policy if exists "service role full access" on public.project_revisions;
create policy "auth all project_revisions" on public.project_revisions
  for all to authenticated using (true) with check (true);

-- invoices no tenía policy de UPDATE, así que regenerar el PDF no podía
-- guardar pdf_storage_path. Queda filtrada por pestaña (kanban/facturas).
create policy "auth update invoices" on public.invoices
  for update to authenticated using (true) with check (true);

-- claim_invoice_number es security definer (salta RLS) y la podía llamar
-- cualquiera, incluso sin sesión, quemando números de factura. Ahora exige
-- la pestaña de kanban o facturas.
create or replace function public.claim_invoice_number()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if not public.has_any_tab(array['kanban', 'facturas']) then
    raise exception 'No tenés permiso para facturar' using errcode = '42501';
  end if;
  update public.invoice_settings
  set next_number = next_number + 1
  where id = 1
  returning next_number - 1 into n;
  return n;
end;
$$;

revoke execute on function public.claim_invoice_number() from public, anon;
grant execute on function public.claim_invoice_number() to authenticated;

-- PDFs de facturas en Storage.
create policy "invoices_by_tab"
  on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'invoices' or public.has_any_tab(array['kanban', 'facturas']))
  with check (bucket_id <> 'invoices' or public.has_any_tab(array['kanban', 'facturas']));

-- ---------------------------------------------------------------------------
-- 3. Bóveda
-- ---------------------------------------------------------------------------
-- Ninguna tabla de la Bóveda tiene policies: con RLS activo y sin policies,
-- solo el service role (el servidor) puede leerlas o escribirlas. Toda la
-- lógica de "quién puede ver qué" vive en lib/vault/.

create table public.vault_credentials (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  kind                text not null default 'otro'
                        check (kind in ('gmail', 'frameio', 'adobe', 'otro')),
  username            text,
  secret_ciphertext   text not null,
  login_url           text,
  change_password_url text,
  notes               text,
  version             integer not null default 1,
  rotated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.vault_access (
  credential_id uuid not null references public.vault_credentials(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  granted_at    timestamptz not null default now(),
  primary key (credential_id, user_id)
);

-- Historial. Guarda una copia del nombre de la credencial y del email de las
-- personas, para que el registro siga legible después de borrar una
-- credencial o un usuario (que es justo cuando más se necesita).
create table public.vault_events (
  id              uuid primary key default gen_random_uuid(),
  credential_id   uuid references public.vault_credentials(id) on delete set null,
  credential_name text,
  event           text not null
                    check (event in ('created', 'updated', 'rotated', 'viewed',
                                     'access_granted', 'access_revoked', 'deleted')),
  actor_id        uuid references auth.users(id) on delete set null,
  actor_email     text,
  target_user_id  uuid references auth.users(id) on delete set null,
  target_email    text,
  created_at      timestamptz not null default now()
);

create index vault_events_credential_idx
  on public.vault_events (credential_id, created_at desc);

-- Avisos por usuario. `discord_sent_at` queda para cuando el bot los mande
-- por DM: el bot va a leer los que tengan discord_sent_at null.
create table public.vault_notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  credential_id   uuid not null references public.vault_credentials(id) on delete cascade,
  message         text not null,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  discord_sent_at timestamptz
);

create index vault_notifications_user_idx
  on public.vault_notifications (user_id, read_at);

alter table public.vault_credentials   enable row level security;
alter table public.vault_access        enable row level security;
alter table public.vault_events        enable row level security;
alter table public.vault_notifications enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Trigger de rotación
-- ---------------------------------------------------------------------------
-- Cuando sube `version` (= se rotó la contraseña), avisa a cada usuario con
-- acceso a ESA credencial, que esté habilitado y que pueda abrir la Bóveda
-- (admin o con la pestaña). El resto no recibe nada.
-- ⚠️ lib/vault/actions.ts (rotateCredential) calcula la misma lista para
-- mostrar a quién se avisó: mantener las dos reglas iguales.
create or replace function public.vault_notify_rotation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version > old.version then
    insert into public.vault_notifications (user_id, credential_id, message)
    select a.user_id, new.id,
           'Cambió la contraseña de ' || new.name || '. Entrá a la Bóveda para ver la nueva.'
    from public.vault_access a
    join public.profiles p on p.id = a.user_id
    where a.credential_id = new.id
      and not p.disabled
      and (p.role = 'admin' or 'boveda' = any (p.allowed_tabs));
  end if;
  return new;
end;
$$;

create trigger vault_credentials_rotation
  after update of version on public.vault_credentials
  for each row execute function public.vault_notify_rotation();
