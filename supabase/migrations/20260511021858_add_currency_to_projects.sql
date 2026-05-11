-- Agrega columna currency a projects.
-- Las opciones cubren las monedas que Tangerine Studios puede cobrar: ARS (default), USD y EUR.

create type currency_code as enum ('ARS', 'USD', 'EUR');

alter table projects
  add column currency currency_code not null default 'ARS';
