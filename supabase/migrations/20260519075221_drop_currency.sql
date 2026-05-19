-- =========================================================================
-- Simplificación a moneda única: todos los pagos y cobros son en USD.
-- Se elimina la columna `currency` de projects y el enum `currency_code`.
-- =========================================================================

alter table public.projects drop column if exists currency;

drop type if exists public.currency_code;
