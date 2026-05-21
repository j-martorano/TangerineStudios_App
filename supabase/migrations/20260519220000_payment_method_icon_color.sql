-- =========================================================================
-- payment_methods: ícono y color personalizables por método.
-- El ícono es un key de una lista fija definida en la app
-- (components/payment-methods/icon-map.ts) y el color es un hex.
-- =========================================================================

alter table public.payment_methods
  add column if not exists icon text,
  add column if not exists color text not null default '#888888';
