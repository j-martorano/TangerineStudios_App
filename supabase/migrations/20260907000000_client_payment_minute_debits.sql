-- =========================================================================
-- Ajustes negativos de minutos para clientes retainer.
--
-- Desde la pestaña de Pagos se pueden «restar minutos mensuales»: el ajuste
-- queda registrado como una fila más de `client_payments` con `amount = 0` y
-- `minutes_credited` negativo, fechada el día del registro. Reusar la misma
-- tabla hace que el saldo de minutos (acreditados − consumidos) se recalcule
-- solo en kanban, spreadsheet, finanzas y dashboard.
--
-- Para eso hay que soltar el check `minutes_credited >= 0` del create table
-- original. El nombre del constraint lo genera Postgres, así que lo buscamos
-- por definición en vez de asumirlo.
-- =========================================================================

do $$
declare
  con_name text;
begin
  for con_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'client_payments'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%minutes_credited%'
  loop
    execute format(
      'alter table public.client_payments drop constraint %I',
      con_name
    );
  end loop;
end $$;

comment on column public.client_payments.minutes_credited is
  'Minutos acreditados por el pago. Negativo = ajuste manual que resta minutos del saldo del cliente (amount = 0).';
