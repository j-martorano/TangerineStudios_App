-- =========================================================================
-- monthly_settlements: registra que el cobro / pago mensual de un cliente o
-- editor mensual ya fue saldado en un mes específico.
--
-- Modelo: row presente = saldado. Sin row = pendiente.
-- party_type = 'client_cobro' (le cobramos al cliente)
--            | 'editor_pago'  (le pagamos al editor)
-- year_month = 'YYYY-MM' (UTC, mismo formato que usa Finanzas)
-- =========================================================================

create type public.settlement_party_type as enum ('client_cobro', 'editor_pago');

create table public.monthly_settlements (
  year_month  text not null,
  party_type  public.settlement_party_type not null,
  party_id    uuid not null,
  settled_at  timestamptz not null default now(),
  primary key (year_month, party_type, party_id)
);

alter table public.monthly_settlements
  add constraint monthly_settlements_year_month_format
  check (year_month ~ '^[0-9]{4}-[0-9]{2}$');

create index monthly_settlements_year_month_idx
  on public.monthly_settlements(year_month);
