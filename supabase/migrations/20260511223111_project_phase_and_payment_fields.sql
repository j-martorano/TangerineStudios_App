-- Fase B de la spec del cliente:
-- Reemplaza el enum `project_status` (5 valores) por el nuevo `project_phase`
-- (3 valores: editando | por_asignar | terminado) y agrega tres campos
-- independientes para tracking de pagos: cobrado, pagado, invoiced.
--
-- La columna `status` vieja se conserva nullable por compatibilidad y se
-- eliminará en una migración futura cuando todo el código use los campos nuevos.

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

comment on column projects.status is 'DEPRECATED: usar `phase`, `cobrado`, `pagado` e `invoiced`. Se eliminará en una migración futura.';

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
comment on column projects.invoiced is 'Estado de facturación: si | no | parcial.';

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
-- Índices
-- ============================================================
drop index if exists projects_status_idx;
drop index if exists projects_status_position_idx;
create index projects_phase_idx on projects (phase);
create index projects_phase_position_idx on projects (phase, position);
