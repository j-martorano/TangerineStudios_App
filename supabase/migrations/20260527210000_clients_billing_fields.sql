-- Agregar campos de facturación estructurados a la tabla clients
-- billing_info (texto libre) se mantiene para retrocompatibilidad pero ya no se usa en el form

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_id       TEXT,
  ADD COLUMN IF NOT EXISTS address      TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS state        TEXT,
  ADD COLUMN IF NOT EXISTS country      TEXT;
