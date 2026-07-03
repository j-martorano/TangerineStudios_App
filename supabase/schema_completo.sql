-- ========================================
-- 20260511003331_init_schema.sql
-- ========================================
-- TangerineStudios App â€” initial schema
-- Tablas: editors, projects. Status enum + trigger para updated_at.
--
-- NOTE: RLS NO estÃ¡ habilitado en esta migraciÃ³n. La app aÃºn no tiene auth y
-- estamos iterando UI. Antes de cualquier deploy real, agregar una migraciÃ³n
-- de seguimiento que:
--   1) Habilite RLS en ambas tablas.
--   2) Defina policies para el rol `authenticated` (el dueÃ±o).
--   3) Niegue todo al rol `anon`.
-- Mientras tanto, NO usar la anon key para writes desde el browser â€” pasar por
-- server actions / API routes con la service_role key.

-- ============================================================
-- Status enum
-- ============================================================
create type project_status as enum (
  'pending',
  'in_progress',
  'revising',
  'done',
  'invoiced'
);

-- ============================================================
-- editors
-- ============================================================
create table editors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  discord_id  text unique,
  created_at  timestamptz not null default now()
);

comment on table editors is 'Editores freelance. discord_id permite que el bot los identifique con /done.';

-- ============================================================
-- projects
-- ============================================================
create table projects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  client_name  text,
  status       project_status not null default 'pending',
  price        numeric(10, 2),
  editor_id    uuid references editors(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table projects is 'Proyectos de ediciÃ³n. Flujo: pending -> in_progress -> revising -> done -> invoiced.';

create index projects_status_idx on projects (status);
create index projects_editor_id_idx on projects (editor_id);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();


-- ========================================
-- 20260511021858_add_currency_to_projects.sql
-- ========================================
-- Agrega columna currency a projects.
-- Las opciones cubren las monedas que Tangerine Studios puede cobrar: ARS (default), USD y EUR.

create type currency_code as enum ('ARS', 'USD', 'EUR');

alter table projects
  add column currency currency_code not null default 'ARS';


-- ========================================
-- 20260511023407_add_clients_table.sql
-- ========================================
-- Agrega tabla `clients` y FK opcional desde `projects.client_id`.
-- Backfill: por cada client_name Ãºnico de proyectos existentes, crea un cliente y enlaza.
-- La columna `client_name` se conserva por ahora; se eliminarÃ¡ en una migraciÃ³n futura
-- cuando todo el cÃ³digo use `client_id`.

-- ============================================================
-- Tabla clients
-- ============================================================
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

comment on table clients is 'Clientes de Tangerine Studios. Un cliente puede tener varios proyectos.';

-- ============================================================
-- FK en projects
-- ============================================================
alter table projects
  add column client_id uuid references clients(id) on delete set null;

create index projects_client_id_idx on projects (client_id);

-- ============================================================
-- Backfill â€” crear un cliente por cada client_name Ãºnico y linkear
-- ============================================================
insert into clients (name)
select distinct trim(client_name)
from projects
where client_name is not null
  and trim(client_name) <> ''
on conflict (name) do nothing;

update projects p
set client_id = c.id
from clients c
where trim(p.client_name) = c.name
  and p.client_id is null;


-- ========================================
-- 20260511150331_add_position_to_projects.sql
-- ========================================
-- Agrega columna `position` para orden manual de proyectos dentro de cada columna del kanban.
-- Backfill: por cada estado, numerar empezando en 0 (mÃ¡s recientes primero).

alter table projects
  add column position integer not null default 0;

create index projects_status_position_idx on projects (status, position);

-- Backfill: row_number por status ordenando por updated_at desc
with ranked as (
  select id,
         row_number() over (partition by status order by updated_at desc) - 1 as rn
  from projects
)
update projects p
set position = r.rn
from ranked r
where p.id = r.id;


-- ========================================
-- 20260511171828_enrich_clients_editors.sql
-- ========================================
-- Fase A de la spec del cliente:
-- Enriquece clients y editors con datos de calor (operativos) y frÃ­os (admin/legales),
-- y agrega tabla pivot client_editors para la relaciÃ³n many-to-many.

-- ============================================================
-- Enum payment_type
-- ============================================================
create type payment_type as enum ('por_proyecto', 'mensual');

-- ============================================================
-- clients â€” agregar columnas
-- ============================================================
alter table clients
  add column color          text not null default '#FFAC37',
  add column payment_type   payment_type not null default 'por_proyecto',
  add column balance        numeric(12, 2) not null default 0,
  add column agreed_price   numeric(12, 2),
  add column billing_info   text,
  add column contact_method text,
  add column docs_url       text;

comment on column clients.color is 'Color de identificaciÃ³n (hex). Asignado aleatoriamente al crear, editable.';
comment on column clients.payment_type is 'por_proyecto: cobra por proyecto. mensual: abono mensual con saldo.';
comment on column clients.balance is 'Saldo (positivo a favor del cliente, negativo en contra). Solo relevante si payment_type=mensual.';
comment on column clients.agreed_price is 'Precio acordado base (por proyecto o por hora/minuto/mes segÃºn tipo).';
comment on column clients.billing_info is 'Datos de facturaciÃ³n libres (CUIT, razÃ³n social, direcciÃ³n, etc).';
comment on column clients.contact_method is 'Medio de comunicaciÃ³n preferido (email, whatsapp, etc).';
comment on column clients.docs_url is 'URL a carpeta o documento con NDA/contrato.';

-- ============================================================
-- editors â€” agregar columnas
-- ============================================================
alter table editors
  add column bank_info      text,
  add column contact_method text,
  add column docs_url       text;

comment on column editors.bank_info is 'Cuenta bancaria, alias, CBU/CVU o ID equivalente para transferencias.';
comment on column editors.contact_method is 'Medio de comunicaciÃ³n preferido (email, whatsapp, etc).';
comment on column editors.docs_url is 'URL a carpeta o documento con NDA/contrato del editor.';

-- ============================================================
-- Tabla pivot client_editors (many-to-many)
-- ============================================================
create table client_editors (
  client_id   uuid not null references clients(id) on delete cascade,
  editor_id   uuid not null references editors(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, editor_id)
);

create index client_editors_client_idx on client_editors (client_id);
create index client_editors_editor_idx on client_editors (editor_id);

comment on table client_editors is 'RelaciÃ³n many-to-many cliente <-> editor. Un cliente puede tener varios editores asignados y viceversa.';

-- ============================================================
-- Backfill: asignar colores aleatorios de una paleta a clientes existentes
-- ============================================================
do $$
declare
  palette text[] := array[
    '#FFAC37', '#FFB93F', '#ED254E', '#3B82F6', '#10B981',
    '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#F97316'
  ];
  rec record;
  idx int;
begin
  for rec in select id from clients order by created_at loop
    idx := 1 + floor(random() * array_length(palette, 1))::int;
    update clients set color = palette[idx] where id = rec.id;
  end loop;
end $$;

-- ============================================================
-- Backfill: para cada proyecto existente con editor asignado,
-- crear la relaciÃ³n cliente <-> editor en la pivot.
-- ============================================================
insert into client_editors (client_id, editor_id)
select distinct p.client_id, p.editor_id
from projects p
where p.client_id is not null
  and p.editor_id is not null
on conflict do nothing;


-- ========================================
-- 20260511212709_contact_fields_split.sql
-- ========================================
-- Reemplaza el campo libre `contact_method` por campos separados (email + phone)
-- en clients y editors. Como ningÃºn registro tenÃ­a contact_method poblado todavÃ­a,
-- se puede dropear sin backfill.

alter table clients drop column if exists contact_method;
alter table clients add column email text;
alter table clients add column phone text;

alter table editors add column email text;
alter table editors add column phone text;

comment on column clients.email is 'Email de contacto del cliente.';
comment on column clients.phone is 'TelÃ©fono / WhatsApp del cliente.';
comment on column editors.email is 'Email del editor.';
comment on column editors.phone is 'TelÃ©fono / WhatsApp del editor.';


-- ========================================
-- 20260511214212_drop_editor_contact_method.sql
-- ========================================
-- Drop del campo legacy `contact_method` en editors.
-- Lo reemplazan los campos `email` y `phone` agregados en la migraciÃ³n anterior.

alter table editors drop column if exists contact_method;


-- ========================================
-- 20260511223111_project_phase_and_payment_fields.sql
-- ========================================
-- Fase B de la spec del cliente:
-- Reemplaza el enum `project_status` (5 valores) por el nuevo `project_phase`
-- (3 valores: editando | por_asignar | terminado) y agrega tres campos
-- independientes para tracking de pagos: cobrado, pagado, invoiced.
--
-- La columna `status` vieja se conserva nullable por compatibilidad y se
-- eliminarÃ¡ en una migraciÃ³n futura cuando todo el cÃ³digo use los campos nuevos.

-- ============================================================
-- Enums nuevos
-- ============================================================
create type project_phase as enum ('editando', 'por_asignar', 'terminado');
create type cobrado_status as enum ('si', 'no', 'parcial');
create type pagado_status as enum ('pago_total', 'parcial', 'sin_pagar');
create type invoiced_status as enum ('si', 'no', 'parcial');

-- ============================================================
-- Hacer `status` nullable (compat temporal)
-- ============================================================
alter table projects alter column status drop not null;
alter table projects alter column status drop default;

comment on column projects.status is 'DEPRECATED: usar `phase`, `cobrado`, `pagado` e `invoiced`. Se eliminarÃ¡ en una migraciÃ³n futura.';

-- ============================================================
-- Columnas nuevas
-- ============================================================
alter table projects
  add column phase    project_phase   not null default 'por_asignar',
  add column cobrado  cobrado_status  not null default 'no',
  add column pagado   pagado_status   not null default 'sin_pagar',
  add column invoiced invoiced_status not null default 'no';

comment on column projects.phase is 'Fase del proyecto en el flujo de trabajo: editando | por_asignar | terminado.';
comment on column projects.cobrado is 'Estado de cobro del cliente: si | no | parcial.';
comment on column projects.pagado is 'Estado de pago al editor: pago_total | parcial | sin_pagar.';
comment on column projects.invoiced is 'Estado de facturaciÃ³n: si | no | parcial.';

-- ============================================================
-- Backfill desde la columna status vieja
-- ============================================================
update projects set
  phase = case status
    when 'pending'     then 'por_asignar'::project_phase
    when 'in_progress' then 'editando'::project_phase
    when 'revising'    then 'editando'::project_phase
    when 'done'        then 'terminado'::project_phase
    when 'invoiced'    then 'terminado'::project_phase
    else 'por_asignar'::project_phase
  end,
  cobrado = case
    when status = 'invoiced' then 'si'::cobrado_status
    else 'no'::cobrado_status
  end,
  pagado = case
    when status = 'invoiced' then 'pago_total'::pagado_status
    else 'sin_pagar'::pagado_status
  end,
  invoiced = case
    when status = 'invoiced' then 'si'::invoiced_status
    else 'no'::invoiced_status
  end;

-- ============================================================
-- Ãndices
-- ============================================================
drop index if exists projects_status_idx;
drop index if exists projects_status_position_idx;
create index projects_phase_idx on projects (phase);
create index projects_phase_position_idx on projects (phase, position);


-- ========================================
-- 20260512003705_project_code_autogenerate.sql
-- ========================================
-- =========================================================================
-- Auto-generaciÃ³n de project_code formato "001-acme-corps"
--
-- Formato: <nÃºmero 3-pad> + "-" + <slug del nombre del cliente>
-- Ej: "001-acme-corps", "012-estudio-naranja-sa", "045-sin-cliente"
--
-- Es inmutable una vez creado (se usa para automatizaciÃ³n externa: nombres
-- de carpetas Drive, archivos exportados, comandos de bot Discord, etc.).
-- =========================================================================

-- ExtensiÃ³n para quitar acentos en el slug.
create extension if not exists unaccent;

-- Slugify: lowercase + sin acentos + non-alphanumeric â†’ "-" + sin "-" al borde.
-- Ej: "Estudio Naranja S.A." â†’ "estudio-naranja-sa"
--     "Familia PÃ©rez"        â†’ "familia-perez"
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(input, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

-- Secuencia global de nÃºmeros de proyecto.
create sequence if not exists public.projects_code_seq;

-- Columna nueva (nullable de entrada porque la rellena el trigger / backfill).
alter table public.projects
  add column if not exists project_code text;

-- Backfill: asignar cÃ³digos a los proyectos existentes en orden de creaciÃ³n.
-- Cada uno se lleva un nextval de la secuencia â†’ quedan numerados 001, 002, ...
-- Si el cliente fue borrado o no tiene cliente, sufijo "sin-cliente".
do $$
declare
  r record;
  next_num int;
  client_slug text;
begin
  for r in
    select p.id, p.client_id, p.client_name
    from public.projects p
    where p.project_code is null
    order by p.created_at asc, p.id asc
  loop
    next_num := nextval('public.projects_code_seq');

    if r.client_id is not null then
      select public.slugify(c.name) into client_slug
      from public.clients c
      where c.id = r.client_id;
    else
      client_slug := public.slugify(r.client_name);
    end if;

    update public.projects
       set project_code = lpad(next_num::text, 3, '0') || '-' ||
                          coalesce(nullif(client_slug, ''), 'sin-cliente')
     where id = r.id;
  end loop;
end $$;

-- Ahora que estÃ¡ backfilleado, hacemos la columna obligatoria + Ãºnica.
alter table public.projects
  alter column project_code set not null,
  add constraint projects_project_code_unique unique (project_code);

-- Trigger: auto-poblar project_code en cada insert si viene null.
create or replace function public.set_project_code()
returns trigger
language plpgsql
as $$
declare
  next_num int;
  client_slug text;
begin
  if new.project_code is null then
    next_num := nextval('public.projects_code_seq');

    if new.client_id is not null then
      select public.slugify(c.name) into client_slug
      from public.clients c
      where c.id = new.client_id;
    else
      client_slug := public.slugify(new.client_name);
    end if;

    new.project_code := lpad(next_num::text, 3, '0') || '-' ||
                        coalesce(nullif(client_slug, ''), 'sin-cliente');
  end if;
  return new;
end;
$$;

drop trigger if exists projects_set_code_trg on public.projects;
create trigger projects_set_code_trg
  before insert on public.projects
  for each row execute function public.set_project_code();


-- ========================================
-- 20260512004749_project_editors_pivot.sql
-- ========================================
-- =========================================================================
-- Tabla pivot `project_editors`: hasta 2 editores por proyecto
--   - 'primary'  : editor principal (siempre que el proyecto estÃ© asignado)
--   - 'secondary': editor opcional con su propio `cost`
--
-- Reemplaza la columna `projects.editor_id` (modelo single-editor).
-- PK (project_id, role) garantiza mÃ¡ximo 1 primary y 1 secondary por proyecto.
-- =========================================================================

create type public.editor_role as enum ('primary', 'secondary');

create table public.project_editors (
  project_id  uuid not null references public.projects(id) on delete cascade,
  editor_id   uuid not null references public.editors(id) on delete cascade,
  role        public.editor_role not null,
  cost        numeric(12, 2),
  created_at  timestamptz not null default now(),
  primary key (project_id, role)
);

create index project_editors_editor_id_idx on public.project_editors(editor_id);
create index project_editors_role_idx on public.project_editors(role);

-- Backfill: cada proyecto con editor_id pasa a tener un row 'primary' en el pivot.
insert into public.project_editors (project_id, editor_id, role, cost)
select id, editor_id, 'primary', null
from public.projects
where editor_id is not null
on conflict do nothing;

-- Eliminamos la columna vieja â€” el pivot la reemplaza.
alter table public.projects drop column editor_id;


-- ========================================
-- 20260512024458_add_project_duration.sql
-- ========================================
-- =========================================================================
-- DuraciÃ³n del video entregado, en minutos (acepta decimales: 1.5 = 1m30s).
-- Nullable porque sÃ³lo se completa cuando el proyecto estÃ¡ terminado / se
-- conoce el corte final.
-- =========================================================================

alter table public.projects
  add column if not exists duration_minutes numeric;

alter table public.projects
  add constraint projects_duration_nonneg
  check (duration_minutes is null or duration_minutes >= 0);


-- ========================================
-- 20260512025157_add_project_cost.sql
-- ========================================
-- =========================================================================
-- Costo total del proyecto desde la perspectiva del estudio (pagos a editores
-- + materiales + cualquier otro gasto). Misma moneda que `price`.
-- En C5 se calcularÃ¡ `ganancia = price - cost` (o con descuento 10% si es
-- pago mensual del cliente).
-- =========================================================================

alter table public.projects
  add column if not exists cost numeric;

alter table public.projects
  add constraint projects_cost_nonneg
  check (cost is null or cost >= 0);


-- ========================================
-- 20260514220613_editors_payment_type.sql
-- ========================================
-- =========================================================================
-- Editores: tipo de pago + tarifa + salario mensual
--
-- payment_type:
--   - 'por_rate': cobra rate Ã— minuto editado. Cost del proyecto se calcula
--     automÃ¡ticamente con rate * duration.
--   - 'mensual': salario fijo mensual. NO aporta al cost del proyecto;
--     su sueldo se registra en Finanzas a nivel mes.
-- =========================================================================

create type public.editor_payment_type as enum ('por_rate', 'mensual');

alter table public.editors
  add column if not exists payment_type public.editor_payment_type
    not null default 'por_rate',
  add column if not exists rate numeric,
  add column if not exists monthly_fee numeric;

alter table public.editors
  add constraint editors_rate_nonneg
  check (rate is null or rate >= 0),
  add constraint editors_monthly_fee_nonneg
  check (monthly_fee is null or monthly_fee >= 0);


-- ========================================
-- 20260514220616_clients_payment_type_extended.sql
-- ========================================
-- =========================================================================
-- Clientes: ampliar payment_type a 3 valores + monthly_fee
--
-- Cambio semÃ¡ntico importante:
--   - El valor 'por_proyecto' (que histÃ³ricamente significaba "cobrado con
--     rate Ã— duraciÃ³n") se RENOMBRA a 'por_rate' â€” conserva los datos
--     existentes pero refleja mejor su lÃ³gica.
--   - Se agrega un nuevo valor 'por_proyecto' que ahora significa "precio
--     manual fijado por proyecto".
--   - 'mensual' se mantiene; se agrega columna `monthly_fee` para el monto.
--
-- payment_type final:
--   - 'por_proyecto' : precio manual por proyecto (input en el form)
--   - 'por_rate'     : precio auto = agreed_price (rate) Ã— duration
--   - 'mensual'      : monthly_fee fijo a nivel mes; los proyectos no
--                       tienen precio individual
-- =========================================================================

-- Paso 1: renombrar el valor existente para preservar la semÃ¡ntica de los
-- clientes ya cargados.
alter type public.payment_type rename value 'por_proyecto' to 'por_rate';

-- Paso 2: agregar el nuevo valor 'por_proyecto' (con semÃ¡ntica manual).
alter type public.payment_type add value if not exists 'por_proyecto';

-- Paso 3: columna monthly_fee para los clientes mensuales.
alter table public.clients
  add column if not exists monthly_fee numeric;

alter table public.clients
  add constraint clients_monthly_fee_nonneg
  check (monthly_fee is null or monthly_fee >= 0);


-- ========================================
-- 20260515010257_monthly_settlements.sql
-- ========================================
-- =========================================================================
-- monthly_settlements: registra que el cobro / pago mensual de un cliente o
-- editor mensual ya fue saldado en un mes especÃ­fico.
--
-- Modelo: row presente = saldado. Sin row = pendiente.
-- party_type = 'client_cobro' (le cobramos al cliente)
--            | 'editor_pago'  (le pagamos al editor)
-- year_month = 'YYYY-MM' (UTC, mismo formato que usa Finanzas)
-- =========================================================================

create type public.settlement_party_type as enum ('client_cobro', 'editor_pago');

create table public.monthly_settlements (
  year_month  text not null,
  party_type  public.settlement_party_type not null,
  party_id    uuid not null,
  settled_at  timestamptz not null default now(),
  primary key (year_month, party_type, party_id)
);

alter table public.monthly_settlements
  add constraint monthly_settlements_year_month_format
  check (year_month ~ '^[0-9]{4}-[0-9]{2}$');

create index monthly_settlements_year_month_idx
  on public.monthly_settlements(year_month);


-- ========================================
-- 20260515021813_enable_rls.sql
-- ========================================
-- =========================================================================
-- Habilita Row Level Security en todas las tablas de la app + policies
-- "authenticated puede todo" (workspace compartido Erik + Joaco).
-- Los anÃ³nimos quedan bloqueados de raÃ­z.
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


-- ========================================
-- 20260519075221_drop_currency.sql
-- ========================================
-- =========================================================================
-- SimplificaciÃ³n a moneda Ãºnica: todos los pagos y cobros son en USD.
-- Se elimina la columna `currency` de projects y el enum `currency_code`.
-- =========================================================================

alter table public.projects drop column if exists currency;

drop type if exists public.currency_code;


-- ========================================
-- 20260519140000_fixed_services.sql
-- ========================================
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


-- ========================================
-- 20260519150000_payment_methods.sql
-- ========================================
-- =========================================================================
-- payment_methods: catÃ¡logo global de mÃ©todos de cobro/pago (ej. Binance,
-- DolarApp, cuenta de banco). Compartido para que no se repitan tipos.
--
-- editor_payment_methods: pivot editor â†” mÃ©todo, con la info concreta que
-- guarda Joaco para ESE editor en ESE mÃ©todo (alias, CBU, usuario, etc.).
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


-- ========================================
-- 20260519160000_editor_payment_models.sql
-- ========================================
-- =========================================================================
-- Nuevo modelo de pago de editores. Reemplaza el enum viejo ('por_rate',
-- 'mensual') por tres modelos por proyecto:
--
--   - 'flat'          : monto fijo por proyecto (editors.flat_amount).
--   - 'flat_variable' : monto fijo segÃºn el rango de minutos en que cae el
--                       video (tabla editor_payment_tiers).
--   - 'por_minuto'    : rate Ã— minutos finales (editors.rate). Antes 'por_rate'.
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

-- Tramos de FLAT variable: rango de minutos â†’ monto fijo.
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


-- ========================================
-- 20260519170000_project_finalized_archived.sql
-- ========================================
-- =========================================================================
-- Proyectos: estados de "finalizado" y "archivado".
--
--   finalized   : el proyecto se cerrÃ³. Sale del kanban, se bloquea la ediciÃ³n
--                 y entra a Finanzas en el mes `finalized_at`.
--   archived    : borrado lÃ³gico. Los proyectos nunca se borran de verdad;
--                 archivar los saca de las vistas activas pero quedan en el
--                 registro y se pueden ver con el filtro de archivados.
-- =========================================================================

alter table public.projects
  add column if not exists finalized boolean not null default false,
  add column if not exists finalized_at timestamptz,
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists projects_finalized_idx
  on public.projects(finalized);

create index if not exists projects_archived_idx
  on public.projects(archived);


-- ========================================
-- 20260519180000_multi_editor_and_client_minutes.sql
-- ========================================
-- =========================================================================
-- 1. Multi-editor: N editores por proyecto.
--    Antes el pivot permitÃ­a como mÃ¡ximo 2 (PK por rol primary/secondary).
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
--      minutos acreditados por pagos âˆ’ minutos consumidos por proyectos.
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


-- ========================================
-- 20260519190000_user_settings.sql
-- ========================================
-- =========================================================================
-- user_settings: preferencias por usuario (Erik / Joaco). Cada usuario tiene
-- su row con sus preferencias guardadas como JSON (columnas visibles,
-- lÃ­mites de paginaciÃ³n, secciones de Finanzas, etc.).
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


-- ========================================
-- 20260519210000_client_editor_payment_config.sql
-- ========================================
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


-- ========================================
-- 20260519220000_payment_method_icon_color.sql
-- ========================================
-- =========================================================================
-- payment_methods: Ã­cono y color personalizables por mÃ©todo.
-- El Ã­cono es un key de una lista fija definida en la app
-- (components/payment-methods/icon-map.ts) y el color es un hex.
-- =========================================================================

alter table public.payment_methods
  add column if not exists icon text,
  add column if not exists color text not null default '#888888';


-- ========================================
-- 20260519230000_project_type_and_parent.sql
-- ========================================
-- =========================================================================
-- project_type: long_form / short_form / other para categorizar proyectos.
-- parent_id: self-FK opcional. Si estÃ¡ seteado, el proyecto es un short hijo
-- de otro (que actÃºa como "pack"). Solo se permite un nivel de anidaciÃ³n,
-- enforced en app logic. Cascada on delete por si llega a borrarse el padre.
-- =========================================================================

create type public.project_type as enum ('long_form', 'short_form', 'other');

alter table public.projects
  add column if not exists project_type public.project_type
    not null default 'long_form',
  add column if not exists parent_id uuid
    references public.projects(id) on delete cascade;

create index if not exists projects_parent_id_idx
  on public.projects(parent_id);


-- ========================================
-- 20260521000000_project_cobros_and_pagos.sql
-- ========================================
-- =========================================================================
-- Cobros y pagos parciales por proyecto.
--
-- project_cobros: cada cobro recibido del cliente para ESE proyecto.
-- Sumando todos los amounts se sabe cuÃ¡nto falta cobrar vs computePrice.
--
-- project_editor_pagos: cada pago hecho a un editor por su trabajo en ese
-- proyecto. Es por par (project_id, editor_id) â€” un proyecto puede tener N
-- editores, y para cada uno acumulamos pagos hasta llegar a su cost.
-- =========================================================================

create table if not exists public.project_cobros (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists project_cobros_project_id_idx
  on public.project_cobros(project_id);

create table if not exists public.project_editor_pagos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  editor_id uuid not null references public.editors(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists project_editor_pagos_project_id_idx
  on public.project_editor_pagos(project_id);
create index if not exists project_editor_pagos_editor_id_idx
  on public.project_editor_pagos(editor_id);

-- RLS abierto a usuarios autenticados (el resto de las tablas del proyecto
-- usa el mismo patrÃ³n).
alter table public.project_cobros enable row level security;
alter table public.project_editor_pagos enable row level security;

create policy "authenticated all on project_cobros"
  on public.project_cobros
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated all on project_editor_pagos"
  on public.project_editor_pagos
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ========================================
-- 20260525100000_add_en_revision_phase.sql
-- ========================================
-- Agrega la fase "en_revision" al enum project_phase, entre editando y terminado.
ALTER TYPE project_phase ADD VALUE IF NOT EXISTS 'en_revision' AFTER 'editando';


-- ========================================
-- 20260527000000_service_month_entries.sql
-- ========================================
-- Historial de costos de servicios fijos por mes.
-- Meses pasados: se guardan aquÃ­ (editables desde la UI).
-- Mes actual: siempre derivado en vivo de fixed_services.active.
create table if not exists public.service_month_entries (
  service_id uuid          not null references public.fixed_services(id) on delete cascade,
  year_month  char(7)      not null,  -- 'YYYY-MM', ej: '2026-05'
  amount      numeric(10,2) not null default 0,
  primary key (service_id, year_month)
);


-- ========================================
-- 20260527100000_add_pack_project_type.sql
-- ========================================
-- Agrega el tipo 'pack' al enum de tipos de proyecto.
-- La migraciÃ³n del UPDATE va en un archivo separado por la restricciÃ³n de
-- PostgreSQL: no se puede usar un valor nuevo del enum en la misma transacciÃ³n.

alter type public.project_type add value if not exists 'pack';


-- ========================================
-- 20260527110000_migrate_existing_packs.sql
-- ========================================
-- Migra los proyectos que ya tienen hijos al nuevo tipo 'pack'.
-- Debe correr en una transacciÃ³n separada a la del ADD VALUE del enum.

update public.projects
set project_type = 'pack'
where id in (
  select distinct parent_id
  from public.projects
  where parent_id is not null
);


-- ========================================
-- 20260527200000_invoices.sql
-- ========================================
-- â”€â”€ Facturas / Invoices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--
-- invoice_settings : configuraciÃ³n global (una sola fila).
-- invoices         : cabecera + totales de cada factura.
-- invoice_projects : join entre factura y proyectos que cubre.

-- 1. ConfiguraciÃ³n global de facturaciÃ³n
create table if not exists public.invoice_settings (
  id            int primary key default 1,
  constraint    invoice_settings_one_row check (id = 1),
  next_number   int  not null default 1,
  sender_name   text not null default 'JoaquÃ­n Martorano Perozzi',
  sender_address text not null default '',
  sender_city   text not null default '1876 Quilmes Oeste',
  sender_state  text not null default 'Buenos Aires',
  sender_country text not null default 'Argentina',
  sender_email  text not null default 'yoakodesign@gmail.com'
);

insert into public.invoice_settings (id)
values (1)
on conflict do nothing;

-- 2. Tabla de facturas
create table if not exists public.invoices (
  id               uuid        primary key default gen_random_uuid(),
  invoice_number   int         not null unique,
  invoice_code     text        not null unique,          -- 'INV-00001'
  date             date        not null,
  client_id        uuid        references public.clients(id) on delete set null,
  client_name      text        not null default '',
  client_address   text        not null default '',
  client_country   text        not null default '',
  currency_symbol  text        not null default '$',
  items            jsonb       not null default '[]'::jsonb,
  subtotal         numeric(12,2) not null default 0,
  -- Descuento
  discount_enabled  boolean   not null default false,
  discount_type     text      not null default 'percentage'
                              check (discount_type in ('percentage','fixed')),
  discount_value    numeric(12,2) not null default 0,
  discount_amount   numeric(12,2) not null default 0,
  -- Pago inicial (upfront)
  upfront_enabled    boolean  not null default false,
  upfront_percentage numeric(5,2) not null default 0,
  upfront_amount     numeric(12,2) not null default 0,
  -- Total final (balance due)
  total            numeric(12,2) not null default 0,
  notes            text,
  pdf_storage_path text,                                 -- path en el bucket 'invoices'
  created_at       timestamptz not null default now()
);

-- 3. RelaciÃ³n factura â†” proyectos
create table if not exists public.invoice_projects (
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (invoice_id, project_id)
);

-- 4. FunciÃ³n atÃ³mica para reclamar el prÃ³ximo nÃºmero de factura
--    Incrementa el contador y devuelve el nÃºmero asignado.
create or replace function public.claim_invoice_number()
returns int
language sql
security definer
as $$
  update public.invoice_settings
  set next_number = next_number + 1
  where id = 1
  returning next_number - 1;
$$;

-- 5. Ãndices
create index if not exists invoices_date_idx        on public.invoices(date desc);
create index if not exists invoices_client_id_idx   on public.invoices(client_id);
create index if not exists invoice_projects_proj_idx on public.invoice_projects(project_id);

-- 6. RLS
alter table public.invoices         enable row level security;
alter table public.invoice_projects enable row level security;
alter table public.invoice_settings enable row level security;

create policy "auth read invoices"   on public.invoices
  for select to authenticated using (true);
create policy "auth insert invoices" on public.invoices
  for insert to authenticated with check (true);
create policy "auth delete invoices" on public.invoices
  for delete to authenticated using (true);

create policy "auth read invoice_projects"   on public.invoice_projects
  for select to authenticated using (true);
create policy "auth insert invoice_projects" on public.invoice_projects
  for insert to authenticated with check (true);
create policy "auth delete invoice_projects" on public.invoice_projects
  for delete to authenticated using (true);

create policy "auth read invoice_settings"   on public.invoice_settings
  for select to authenticated using (true);
create policy "auth update invoice_settings" on public.invoice_settings
  for update to authenticated using (true);


-- ========================================
-- 20260527210000_clients_billing_fields.sql
-- ========================================
-- Agregar campos de facturaciÃ³n estructurados a la tabla clients
-- billing_info (texto libre) se mantiene para retrocompatibilidad pero ya no se usa en el form

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_id       TEXT,
  ADD COLUMN IF NOT EXISTS address      TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS state        TEXT,
  ADD COLUMN IF NOT EXISTS country      TEXT;


-- ========================================
-- 20260527220000_drop_billing_info.sql
-- ========================================
-- Eliminar el campo billing_info (reemplazado por campos estructurados)
ALTER TABLE public.clients DROP COLUMN IF EXISTS billing_info;


-- ========================================
-- 20260527230000_storage_invoices_policies.sql
-- ========================================
-- PolÃ­ticas RLS para el bucket privado "invoices"
-- El servidor (usuario autenticado) necesita leer, escribir y borrar PDFs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "invoices: authenticated can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices: authenticated can select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "invoices: authenticated can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "invoices: authenticated can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoices');


-- ========================================
-- 20260528000000_discord_link_token.sql
-- ========================================
-- Add discord_link_token to editors for one-time Discord account linking.
-- discord_id (already exists) stores the Discord snowflake once linked.
ALTER TABLE public.editors
  ADD COLUMN IF NOT EXISTS discord_link_token TEXT UNIQUE;


-- ========================================
-- 20260528010000_project_revisions.sql
-- ========================================
-- Historial de revisiones por proyecto (enviadas desde /terminar en Discord)
CREATE TABLE public.project_revisions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_number int         NOT NULL,
  url             text        NOT NULL,
  editor_id       uuid        REFERENCES public.editors(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, revision_number)
);

ALTER TABLE public.project_revisions ENABLE ROW LEVEL SECURITY;

-- Solo el service role (bot) puede insertar/leer revisiones
CREATE POLICY "service role full access" ON public.project_revisions
  USING (true) WITH CHECK (true);


-- ========================================
-- 20260528020000_clients_discord_and_parent.sql
-- ========================================
-- Canal de Discord por cliente (para notificaciones de estado al cliente)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS discord_channel_id text;

-- JerarquÃ­a padre/hijo entre clientes
-- Si se elimina el padre, los hijos se eliminan en cascada
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;



