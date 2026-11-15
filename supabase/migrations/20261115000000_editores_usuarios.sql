-- Vínculo editor ↔ cuenta de la app.
--
-- Un editor (ficha de /editors, con tarifas y Discord) puede tener a lo sumo
-- una cuenta (profiles), y una cuenta corresponde a lo sumo a un editor. El
-- vínculo es opcional y explícito: lo hace un admin desde Usuarios o desde la
-- ficha del editor ("Crear usuario"). No se infiere por nombre.
--
-- Si se borra la cuenta, el editor queda sin vínculo (no se borra la ficha,
-- que tiene proyectos y pagos colgando).

alter table public.editors
  add column user_id uuid unique references public.profiles(id) on delete set null;

comment on column public.editors.user_id is
  'Cuenta de la app de este editor (profiles.id). Null si todavía no tiene.';
