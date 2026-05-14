-- =========================================================================
-- Duración del video entregado, en minutos (acepta decimales: 1.5 = 1m30s).
-- Nullable porque sólo se completa cuando el proyecto está terminado / se
-- conoce el corte final.
-- =========================================================================

alter table public.projects
  add column if not exists duration_minutes numeric;

alter table public.projects
  add constraint projects_duration_nonneg
  check (duration_minutes is null or duration_minutes >= 0);
