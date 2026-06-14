-- Historial de revisiones por proyecto (enviadas desde /terminar en Discord)
CREATE TABLE public.project_revisions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_number int         NOT NULL,
  url             text        NOT NULL,
  editor_id       uuid        REFERENCES public.editors(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, revision_number)
);

ALTER TABLE public.project_revisions ENABLE ROW LEVEL SECURITY;

-- Solo el service role (bot) puede insertar/leer revisiones
CREATE POLICY "service role full access" ON public.project_revisions
  USING (true) WITH CHECK (true);
