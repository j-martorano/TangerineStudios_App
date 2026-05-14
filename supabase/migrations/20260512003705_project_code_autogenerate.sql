-- =========================================================================
-- Auto-generación de project_code formato "001-acme-corps"
--
-- Formato: <número 3-pad> + "-" + <slug del nombre del cliente>
-- Ej: "001-acme-corps", "012-estudio-naranja-sa", "045-sin-cliente"
--
-- Es inmutable una vez creado (se usa para automatización externa: nombres
-- de carpetas Drive, archivos exportados, comandos de bot Discord, etc.).
-- =========================================================================

-- Extensión para quitar acentos en el slug.
create extension if not exists unaccent;

-- Slugify: lowercase + sin acentos + non-alphanumeric → "-" + sin "-" al borde.
-- Ej: "Estudio Naranja S.A." → "estudio-naranja-sa"
--     "Familia Pérez"        → "familia-perez"
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(input, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

-- Secuencia global de números de proyecto.
create sequence if not exists public.projects_code_seq;

-- Columna nueva (nullable de entrada porque la rellena el trigger / backfill).
alter table public.projects
  add column if not exists project_code text;

-- Backfill: asignar códigos a los proyectos existentes en orden de creación.
-- Cada uno se lleva un nextval de la secuencia → quedan numerados 001, 002, ...
-- Si el cliente fue borrado o no tiene cliente, sufijo "sin-cliente".
do $$
declare
  r record;
  next_num int;
  client_slug text;
begin
  for r in
    select p.id, p.client_id, p.client_name
    from public.projects p
    where p.project_code is null
    order by p.created_at asc, p.id asc
  loop
    next_num := nextval('public.projects_code_seq');

    if r.client_id is not null then
      select public.slugify(c.name) into client_slug
      from public.clients c
      where c.id = r.client_id;
    else
      client_slug := public.slugify(r.client_name);
    end if;

    update public.projects
       set project_code = lpad(next_num::text, 3, '0') || '-' ||
                          coalesce(nullif(client_slug, ''), 'sin-cliente')
     where id = r.id;
  end loop;
end $$;

-- Ahora que está backfilleado, hacemos la columna obligatoria + única.
alter table public.projects
  alter column project_code set not null,
  add constraint projects_project_code_unique unique (project_code);

-- Trigger: auto-poblar project_code en cada insert si viene null.
create or replace function public.set_project_code()
returns trigger
language plpgsql
as $$
declare
  next_num int;
  client_slug text;
begin
  if new.project_code is null then
    next_num := nextval('public.projects_code_seq');

    if new.client_id is not null then
      select public.slugify(c.name) into client_slug
      from public.clients c
      where c.id = new.client_id;
    else
      client_slug := public.slugify(new.client_name);
    end if;

    new.project_code := lpad(next_num::text, 3, '0') || '-' ||
                        coalesce(nullif(client_slug, ''), 'sin-cliente');
  end if;
  return new;
end;
$$;

drop trigger if exists projects_set_code_trg on public.projects;
create trigger projects_set_code_trg
  before insert on public.projects
  for each row execute function public.set_project_code();
