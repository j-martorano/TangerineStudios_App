-- Agrega columna `position` para orden manual de proyectos dentro de cada columna del kanban.
-- Backfill: por cada estado, numerar empezando en 0 (más recientes primero).

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
