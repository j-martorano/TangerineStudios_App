-- =========================================================================
-- project_type: long_form / short_form / other para categorizar proyectos.
-- parent_id: self-FK opcional. Si está seteado, el proyecto es un short hijo
-- de otro (que actúa como "pack"). Solo se permite un nivel de anidación,
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
