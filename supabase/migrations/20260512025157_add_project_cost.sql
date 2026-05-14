-- =========================================================================
-- Costo total del proyecto desde la perspectiva del estudio (pagos a editores
-- + materiales + cualquier otro gasto). Misma moneda que `price`.
-- En C5 se calculará `ganancia = price - cost` (o con descuento 10% si es
-- pago mensual del cliente).
-- =========================================================================

alter table public.projects
  add column if not exists cost numeric;

alter table public.projects
  add constraint projects_cost_nonneg
  check (cost is null or cost >= 0);
