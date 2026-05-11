-- Agrega tabla `clients` y FK opcional desde `projects.client_id`.
-- Backfill: por cada client_name único de proyectos existentes, crea un cliente y enlaza.
-- La columna `client_name` se conserva por ahora; se eliminará en una migración futura
-- cuando todo el código use `client_id`.

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
-- Backfill — crear un cliente por cada client_name único y linkear
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
