-- =========================================================================
-- Editores: tipo de pago + tarifa + salario mensual
--
-- payment_type:
--   - 'por_rate': cobra rate × minuto editado. Cost del proyecto se calcula
--     automáticamente con rate * duration.
--   - 'mensual': salario fijo mensual. NO aporta al cost del proyecto;
--     su sueldo se registra en Finanzas a nivel mes.
-- =========================================================================

create type public.editor_payment_type as enum ('por_rate', 'mensual');

alter table public.editors
  add column if not exists payment_type public.editor_payment_type
    not null default 'por_rate',
  add column if not exists rate numeric,
  add column if not exists monthly_fee numeric;

alter table public.editors
  add constraint editors_rate_nonneg
  check (rate is null or rate >= 0),
  add constraint editors_monthly_fee_nonneg
  check (monthly_fee is null or monthly_fee >= 0);
