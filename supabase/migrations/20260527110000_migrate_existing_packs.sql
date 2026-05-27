-- Migra los proyectos que ya tienen hijos al nuevo tipo 'pack'.
-- Debe correr en una transacción separada a la del ADD VALUE del enum.

update public.projects
set project_type = 'pack'
where id in (
  select distinct parent_id
  from public.projects
  where parent_id is not null
);
