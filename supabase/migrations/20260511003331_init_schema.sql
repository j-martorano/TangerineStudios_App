-- TangerineStudios App — initial schema
-- Tablas: editors, projects. Status enum + trigger para updated_at.
--
-- NOTE: RLS NO está habilitado en esta migración. La app aún no tiene auth y
-- estamos iterando UI. Antes de cualquier deploy real, agregar una migración
-- de seguimiento que:
--   1) Habilite RLS en ambas tablas.
--   2) Defina policies para el rol `authenticated` (el dueño).
--   3) Niegue todo al rol `anon`.
-- Mientras tanto, NO usar la anon key para writes desde el browser — pasar por
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

comment on table projects is 'Proyectos de edición. Flujo: pending -> in_progress -> revising -> done -> invoiced.';

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
