-- =========================================================================
-- Tabla pivot `project_editors`: hasta 2 editores por proyecto
--   - 'primary'  : editor principal (siempre que el proyecto esté asignado)
--   - 'secondary': editor opcional con su propio `cost`
--
-- Reemplaza la columna `projects.editor_id` (modelo single-editor).
-- PK (project_id, role) garantiza máximo 1 primary y 1 secondary por proyecto.
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

-- Eliminamos la columna vieja — el pivot la reemplaza.
alter table public.projects drop column editor_id;
