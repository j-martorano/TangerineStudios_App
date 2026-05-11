-- Drop del campo legacy `contact_method` en editors.
-- Lo reemplazan los campos `email` y `phone` agregados en la migración anterior.

alter table editors drop column if exists contact_method;
