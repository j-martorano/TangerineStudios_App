-- Seed de datos de prueba — TangerineStudios App
-- Idempotente: si los registros ya existen, no hace nada (ON CONFLICT DO NOTHING).
-- Para aplicar: pegar en el SQL Editor de supabase.com (o correr con psql).

-- ============================================================
-- Editores
-- ============================================================
insert into editors (id, name, discord_id) values
  ('11111111-1111-1111-1111-111111111101', 'Lucía Méndez',     '298745632100000001'),
  ('11111111-1111-1111-1111-111111111102', 'Tomás Iriarte',    '298745632100000002'),
  ('11111111-1111-1111-1111-111111111103', 'Sofía Albarracín', '298745632100000003')
on conflict (id) do nothing;

-- ============================================================
-- Proyectos — uno por cada estado, editores rotando
-- ============================================================
insert into projects (id, title, client_name, status, price, editor_id) values
  ('22222222-2222-2222-2222-222222222201', 'Reel demo 2026 — Acme',           'Acme S.A.',            'pending',     45000.00, '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222202', 'Spot publicitario otoño',         'Estudio Naranja',      'in_progress', 80000.00, '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222203', 'Casamiento Pérez/González',       'Familia Pérez',        'revising',    65000.00, '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222204', 'Videoclip — banda Lunario',       'Lunario Producciones', 'done',       110000.00, '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222205', 'Corporativo onboarding — TechCo', 'TechCo',               'invoiced',    95000.00, '11111111-1111-1111-1111-111111111102')
on conflict (id) do nothing;
