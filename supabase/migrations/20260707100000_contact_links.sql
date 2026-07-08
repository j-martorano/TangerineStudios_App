-- Reemplaza email + phone por un array JSONB flexible en clients y editors.
-- Cada entrada: { "type": "email"|"whatsapp"|"phone"|"instagram"|..., "value": "..." }

-- ── clients ──────────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_links JSONB NOT NULL DEFAULT '[]';

UPDATE public.clients
SET contact_links = CASE
  WHEN email IS NOT NULL AND phone IS NOT NULL THEN
    jsonb_build_array(
      jsonb_build_object('type', 'email',     'value', email),
      jsonb_build_object('type', 'whatsapp',  'value', phone)
    )
  WHEN email IS NOT NULL THEN
    jsonb_build_array(jsonb_build_object('type', 'email', 'value', email))
  WHEN phone IS NOT NULL THEN
    jsonb_build_array(jsonb_build_object('type', 'whatsapp', 'value', phone))
  ELSE '[]'::jsonb
END;

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;

-- ── editors ──────────────────────────────────────────────────────────────────
ALTER TABLE public.editors
  ADD COLUMN IF NOT EXISTS contact_links JSONB NOT NULL DEFAULT '[]';

UPDATE public.editors
SET contact_links = CASE
  WHEN email IS NOT NULL AND phone IS NOT NULL THEN
    jsonb_build_array(
      jsonb_build_object('type', 'email',     'value', email),
      jsonb_build_object('type', 'whatsapp',  'value', phone)
    )
  WHEN email IS NOT NULL THEN
    jsonb_build_array(jsonb_build_object('type', 'email', 'value', email))
  WHEN phone IS NOT NULL THEN
    jsonb_build_array(jsonb_build_object('type', 'whatsapp', 'value', phone))
  ELSE '[]'::jsonb
END;

ALTER TABLE public.editors
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;
