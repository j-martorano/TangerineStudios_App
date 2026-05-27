-- Eliminar el campo billing_info (reemplazado por campos estructurados)
ALTER TABLE public.clients DROP COLUMN IF EXISTS billing_info;
