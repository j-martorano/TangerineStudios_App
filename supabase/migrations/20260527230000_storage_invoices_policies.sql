-- Políticas RLS para el bucket privado "invoices"
-- El servidor (usuario autenticado) necesita leer, escribir y borrar PDFs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "invoices: authenticated can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices: authenticated can select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "invoices: authenticated can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "invoices: authenticated can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoices');
