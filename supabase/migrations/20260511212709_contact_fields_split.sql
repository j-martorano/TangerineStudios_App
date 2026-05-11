-- Reemplaza el campo libre `contact_method` por campos separados (email + phone)
-- en clients y editors. Como ningún registro tenía contact_method poblado todavía,
-- se puede dropear sin backfill.

alter table clients drop column if exists contact_method;
alter table clients add column email text;
alter table clients add column phone text;

alter table editors add column email text;
alter table editors add column phone text;

comment on column clients.email is 'Email de contacto del cliente.';
comment on column clients.phone is 'Teléfono / WhatsApp del cliente.';
comment on column editors.email is 'Email del editor.';
comment on column editors.phone is 'Teléfono / WhatsApp del editor.';
