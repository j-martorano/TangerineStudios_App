-- Agrega la fase "en_revision" al enum project_phase, entre editando y terminado.
ALTER TYPE project_phase ADD VALUE IF NOT EXISTS 'en_revision' AFTER 'editando';
