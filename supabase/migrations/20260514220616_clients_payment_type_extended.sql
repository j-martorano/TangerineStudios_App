-- =========================================================================
-- Clientes: ampliar payment_type a 3 valores + monthly_fee
--
-- Cambio semántico importante:
--   - El valor 'por_proyecto' (que históricamente significaba "cobrado con
--     rate × duración") se RENOMBRA a 'por_rate' — conserva los datos
--     existentes pero refleja mejor su lógica.
--   - Se agrega un nuevo valor 'por_proyecto' que ahora significa "precio
--     manual fijado por proyecto".
--   - 'mensual' se mantiene; se agrega columna `monthly_fee` para el monto.
--
-- payment_type final:
--   - 'por_proyecto' : precio manual por proyecto (input en el form)
--   - 'por_rate'     : precio auto = agreed_price (rate) × duration
--   - 'mensual'      : monthly_fee fijo a nivel mes; los proyectos no
--                       tienen precio individual
-- =========================================================================

-- Paso 1: renombrar el valor existente para preservar la semántica de los
-- clientes ya cargados.
alter type public.payment_type rename value 'por_proyecto' to 'por_rate';

-- Paso 2: agregar el nuevo valor 'por_proyecto' (con semántica manual).
alter type public.payment_type add value if not exists 'por_proyecto';

-- Paso 3: columna monthly_fee para los clientes mensuales.
alter table public.clients
  add column if not exists monthly_fee numeric;

alter table public.clients
  add constraint clients_monthly_fee_nonneg
  check (monthly_fee is null or monthly_fee >= 0);
