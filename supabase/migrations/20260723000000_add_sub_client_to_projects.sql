-- Etiqueta de subcliente para proyectos hijos de un pack.
-- Permite identificar a qué subcliente corresponde cada video dentro de un pack
-- sin necesidad de crear entidades de cliente en el sistema.
alter table public.projects
  add column if not exists sub_client text default null;
