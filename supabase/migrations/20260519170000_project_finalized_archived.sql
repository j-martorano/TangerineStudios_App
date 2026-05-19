-- =========================================================================
-- Proyectos: estados de "finalizado" y "archivado".
--
--   finalized   : el proyecto se cerró. Sale del kanban, se bloquea la edición
--                 y entra a Finanzas en el mes `finalized_at`.
--   archived    : borrado lógico. Los proyectos nunca se borran de verdad;
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
