-- =============================================================================
-- Usuarios, permisos por pestaña y Bóveda de credenciales.
--
-- 1. profiles: rol (admin | member) + pestañas visibles de cada usuario.
-- 2. Permisos por tabla según pestaña: tabs_for(tabla, 'read'|'write') dice
--    qué pestañas habilitan leer o escribir cada tabla. Se aplican como
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
-- que nadie pierda acceso con este deploy. Joaco después baja de rol a quien
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

-- Qué pestañas habilitan leer ('read') o escribir ('write') cada tabla.
-- Sale de lo que muestra y edita cada pantalla (incluye formularios que una
-- pestaña abre aunque escriban en otra tabla: p. ej. crear un cliente desde
-- el formulario de proyecto). Leer siempre incluye a quien puede escribir.
-- Tabla que no está acá = solo admins.
--
-- ⚠️ Mantener en sincronía con lib/auth/scopes.ts (guards de las actions).
create or replace function public.tabs_for(tbl text, mode text)
returns text[]
language sql
immutable
as $$
  select case
    when tbl in ('projects', 'project_editors', 'project_cobros',
                 'project_editor_pagos', 'project_revisions') then
      array['dashboard', 'kanban', 'projects', 'finanzas', 'facturas', 'mantenimiento']
    when tbl = 'clients' then
      case when mode = 'read'
        then array['dashboard', 'kanban', 'projects', 'clients', 'editors', 'finanzas', 'facturas']
        else array['dashboard', 'kanban', 'projects', 'clients', 'editors'] end
    when tbl in ('client_editors', 'client_editor_payment_tiers') then
      case when mode = 'read'
        then array['dashboard', 'kanban', 'projects', 'clients', 'editors', 'finanzas']
        else array['dashboard', 'kanban', 'projects', 'clients', 'editors'] end
    when tbl in ('editors', 'editor_payment_tiers') then
      case when mode = 'read'
        then array['dashboard', 'kanban', 'projects', 'clients', 'editors', 'finanzas', 'facturas']
        else array['dashboard', 'clients', 'editors'] end
    when tbl = 'editor_payment_methods' then
      array['dashboard', 'clients', 'editors']
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

-- Cuatro policies restrictivas por tabla (se suman con AND a las que ya
-- existían, que siguen igual).
do $$
declare
  t record;
  r text;
  w text;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and rowsecurity
      and tablename not in ('profiles', 'user_settings')
  loop
    r := format('public.has_any_tab(public.tabs_for(%L, ''read'') || public.tabs_for(%L, ''write''))',
                t.tablename, t.tablename);
    w := format('public.has_any_tab(public.tabs_for(%L, ''write''))', t.tablename);

    execute format('create policy "tab_read" on public.%I as restrictive for select to authenticated using (%s)',
                   t.tablename, r);
    execute format('create policy "tab_insert" on public.%I as restrictive for insert to authenticated with check (%s)',
                   t.tablename, w);
    execute format('create policy "tab_update" on public.%I as restrictive for update to authenticated using (%s) with check (%s)',
                   t.tablename, w, w);
    execute format('create policy "tab_delete" on public.%I as restrictive for delete to authenticated using (%s)',
                   t.tablename, w);
  end loop;
end;
$$;

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

create table public.vault_events (
  id             uuid primary key default gen_random_uuid(),
  credential_id  uuid references public.vault_credentials(id) on delete cascade,
  event          text not null
                   check (event in ('created', 'updated', 'rotated', 'viewed',
                                    'access_granted', 'access_revoked')),
  actor_id       uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
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
-- acceso a ESA credencial y que no esté deshabilitado. El resto no recibe nada.
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
      and not p.disabled;
  end if;
  return new;
end;
$$;

create trigger vault_credentials_rotation
  after update of version on public.vault_credentials
  for each row execute function public.vault_notify_rotation();
