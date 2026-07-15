-- =========================================================================
-- project_templates: plantillas prediseñadas para auto-completar proyectos.
-- Guardan la configuración completa (tipo, fase, precio, costo, duración)
-- pero no el título ni el cliente — esos son específicos de cada proyecto.
-- =========================================================================

create table public.project_templates (
  id               uuid                not null default gen_random_uuid() primary key,
  name             text                not null,
  project_type     public.project_type not null default 'long_form',
  phase            public.project_phase not null default 'por_asignar',
  price            numeric,
  cost             numeric,
  duration_minutes numeric,
  created_at       timestamptz         not null default now()
);
