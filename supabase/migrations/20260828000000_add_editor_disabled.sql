-- Permite marcar editores como deshabilitados sin borrarlos.
-- NULL = habilitado. Fecha = deshabilitado desde esa fecha.
alter table public.editors
  add column if not exists disabled_at timestamptz default null;
