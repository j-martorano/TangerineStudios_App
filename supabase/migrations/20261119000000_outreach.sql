-- Outreach: constructor de mensajes para contactar leads + registro de lo enviado.
--
-- 1. outreach_templates  → mensajes base (plantillas con etiquetas). Hay una
--                          biblioteca: cada plataforma elige cuál usa y
--                          outreach_settings dice cuál es el default general.
-- 2. outreach_platforms  → dónde se manda (Reddit, Instagram…), con ícono
--                          (del catálogo o una imagen subida) y su plantilla.
-- 3. outreach_resources  → páginas (web, portfolio) y samples (ejemplos de
--                          edición, en general links). Cada uno tiene una
--                          etiqueta ({PAGINA_TANGERINE_WEB}, {SAMPLE_TALKING_HEAD})
--                          que la plantilla puede usar para que el link se
--                          pegue solo, y un ícono (favicon detectado o imagen
--                          subida). `description` queda para que una IA elija
--                          qué samples van según el lead.
-- 4. outreach_messages   → registro de cada mensaje enviado, con su estado.
--                          Guarda una copia de los recursos usados (jsonb) y
--                          del nombre de la plataforma para que el historial
--                          sobreviva a borrados.
--
-- Permisos: las cinco tablas son de la pestaña "outreach" (tabs_for +
-- apply_tab_policies). Las lecturas de la app van con service role. Los
-- íconos subidos van al bucket público `outreach-icons` (escribe el servidor).

create table public.outreach_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  body       text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outreach_settings (
  id                  integer primary key default 1 check (id = 1),
  default_template_id uuid references public.outreach_templates(id) on delete set null,
  updated_at          timestamptz not null default now()
);

create table public.outreach_platforms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- key del catálogo de íconos (components/outreach/platform-icon.tsx)
  icon        text,
  -- imagen subida o detectada; si está, le gana al catálogo
  icon_url    text,
  color       text not null default '#888888',
  -- Plantilla de esta plataforma. Null = usa la default de outreach_settings.
  template_id uuid references public.outreach_templates(id) on delete set null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.outreach_resources (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('pagina', 'sample')),
  name        text not null,
  url         text not null,
  -- Etiqueta para la plantilla, sin llaves: PAGINA_TANGERINE_WEB, SAMPLE_TALKING_HEAD.
  tag         text not null unique check (tag ~ '^[A-Z0-9_]+$'),
  icon_url    text,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.outreach_messages (
  id            uuid primary key default gen_random_uuid(),
  client_name   text not null,
  platform_id   uuid references public.outreach_platforms(id) on delete set null,
  platform_name text not null default '',
  message       text not null,
  post_url      text,
  status        text not null default 'enviado'
                  check (status in ('enviado', 'respondido', 'interesado', 'cliente', 'descartado')),
  notes         text,
  -- [{ "kind": "sample", "name": "Talking-head", "url": "https://…", "iconUrl": null }, …]
  resources     jsonb not null default '[]'::jsonb,
  -- Fecha de envío (calendario de Argentina). Decide en qué mes se muestra.
  sent_at       date not null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index outreach_messages_sent_at_idx
  on public.outreach_messages (sent_at desc, created_at desc);

create trigger outreach_templates_set_updated_at
  before update on public.outreach_templates
  for each row execute function set_updated_at();
create trigger outreach_settings_set_updated_at
  before update on public.outreach_settings
  for each row execute function set_updated_at();
create trigger outreach_platforms_set_updated_at
  before update on public.outreach_platforms
  for each row execute function set_updated_at();
create trigger outreach_resources_set_updated_at
  before update on public.outreach_resources
  for each row execute function set_updated_at();
create trigger outreach_messages_set_updated_at
  before update on public.outreach_messages
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
alter table public.outreach_templates enable row level security;
alter table public.outreach_settings  enable row level security;
alter table public.outreach_platforms enable row level security;
alter table public.outreach_resources enable row level security;
alter table public.outreach_messages  enable row level security;

create policy "auth all outreach_templates" on public.outreach_templates
  for all to authenticated using (true) with check (true);
create policy "auth all outreach_settings" on public.outreach_settings
  for all to authenticated using (true) with check (true);
create policy "auth all outreach_platforms" on public.outreach_platforms
  for all to authenticated using (true) with check (true);
create policy "auth all outreach_resources" on public.outreach_resources
  for all to authenticated using (true) with check (true);
create policy "auth all outreach_messages" on public.outreach_messages
  for all to authenticated using (true) with check (true);

-- Misma función que en 20261113000000_usuarios_permisos_boveda.sql, más las
-- tablas de outreach (solo la pestaña "outreach").
-- ⚠️ Mantener en sincronía con lib/auth/scopes.ts.
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
    when tbl in ('outreach_templates', 'outreach_settings', 'outreach_platforms',
                 'outreach_resources', 'outreach_messages') then
      array['outreach']
    else '{}'::text[]
  end;
$$;

select public.apply_tab_policies('outreach_templates');
select public.apply_tab_policies('outreach_settings');
select public.apply_tab_policies('outreach_platforms');
select public.apply_tab_policies('outreach_resources');
select public.apply_tab_policies('outreach_messages');

-- Íconos subidos (plataformas, páginas y samples). Bucket público de lectura;
-- escribe solo el servidor (service role), así que no hace falta policy de
-- escritura para usuarios.
insert into storage.buckets (id, name, public)
values ('outreach-icons', 'outreach-icons', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Datos iniciales (se editan desde /outreach/configuracion)
-- ---------------------------------------------------------------------------
insert into public.outreach_templates (id, name, body, sort_order) values
  ('a0000000-0000-4000-8000-000000000001', 'Default',
'Hey! I''m Yoako, a senior video editor with 8 years of experience, and I run Tangerine Studios, where we specialize in YouTube videos, Meta ads, and social media content. We excel particularly at [educational YouTube videos], and that''s why I found your post very interesting!

We have a team of editors, so we can handle more content than a single editor while keeping everything consistent and high-quality. I''m personally involved in every project, bringing my editing expertise and strategic input to help make each video as engaging and effective as possible.

Here''s our website and a couple of examples relevant to what you''re looking for:
{PAGINAS}
{SAMPLES}', 1);

insert into public.outreach_settings (id, default_template_id)
values (1, 'a0000000-0000-4000-8000-000000000001');

insert into public.outreach_platforms (name, icon, color, sort_order) values
  ('Reddit',    'message-circle', '#FF4500', 1),
  ('Instagram', 'camera',         '#E1306C', 2),
  ('LinkedIn',  'briefcase',      '#0A66C2', 3),
  ('Email',     'mail',           '#37ACFF', 4),
  ('Upwork',    'globe',          '#14A800', 5);
