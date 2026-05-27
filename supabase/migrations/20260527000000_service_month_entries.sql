-- Historial de costos de servicios fijos por mes.
-- Meses pasados: se guardan aquí (editables desde la UI).
-- Mes actual: siempre derivado en vivo de fixed_services.active.
create table if not exists public.service_month_entries (
  service_id uuid          not null references public.fixed_services(id) on delete cascade,
  year_month  char(7)      not null,  -- 'YYYY-MM', ej: '2026-05'
  amount      numeric(10,2) not null default 0,
  primary key (service_id, year_month)
);
