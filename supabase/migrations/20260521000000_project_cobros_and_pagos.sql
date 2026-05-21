-- =========================================================================
-- Cobros y pagos parciales por proyecto.
--
-- project_cobros: cada cobro recibido del cliente para ESE proyecto.
-- Sumando todos los amounts se sabe cuánto falta cobrar vs computePrice.
--
-- project_editor_pagos: cada pago hecho a un editor por su trabajo en ese
-- proyecto. Es por par (project_id, editor_id) — un proyecto puede tener N
-- editores, y para cada uno acumulamos pagos hasta llegar a su cost.
-- =========================================================================

create table if not exists public.project_cobros (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists project_cobros_project_id_idx
  on public.project_cobros(project_id);

create table if not exists public.project_editor_pagos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  editor_id uuid not null references public.editors(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists project_editor_pagos_project_id_idx
  on public.project_editor_pagos(project_id);
create index if not exists project_editor_pagos_editor_id_idx
  on public.project_editor_pagos(editor_id);

-- RLS abierto a usuarios autenticados (el resto de las tablas del proyecto
-- usa el mismo patrón).
alter table public.project_cobros enable row level security;
alter table public.project_editor_pagos enable row level security;

create policy "authenticated all on project_cobros"
  on public.project_cobros
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated all on project_editor_pagos"
  on public.project_editor_pagos
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
