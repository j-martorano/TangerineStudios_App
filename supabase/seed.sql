-- Seed de datos de prueba — Tangerine Studios
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
-- Proyectos — combinaciones de fase + estado de pago, monedas mixtas.
-- `project_code` lo rellena el trigger `projects_set_code_trg`.
-- Los editores se asignan por separado en la pivot `project_editors`.
-- ============================================================
insert into projects (id, title, client_name, phase, cobrado, pagado, invoiced, price, currency) values
  ('22222222-2222-2222-2222-222222222201', 'Reel demo 2026 — Acme',           'Acme S.A.',            'por_asignar', 'no',      'sin_pagar', 'no', 45000.00, 'ARS'),
  ('22222222-2222-2222-2222-222222222202', 'Spot publicitario otoño',         'Estudio Naranja',      'editando',    'no',      'sin_pagar', 'no', 80000.00, 'ARS'),
  ('22222222-2222-2222-2222-222222222203', 'Casamiento Pérez/González',       'Familia Pérez',        'editando',    'parcial', 'sin_pagar', 'no', 65000.00, 'ARS'),
  ('22222222-2222-2222-2222-222222222204', 'Videoclip — banda Lunario',       'Lunario Producciones', 'terminado',   'no',      'sin_pagar', 'no',  1200.00, 'USD'),
  ('22222222-2222-2222-2222-222222222205', 'Corporativo onboarding — TechCo', 'TechCo',               'terminado',   'si',      'pago_total','si',   800.00, 'EUR')
on conflict (id) do nothing;

-- ============================================================
-- Asignación de editores (primary; el secondary es opcional y queda vacío en
-- los seeds — se puede agregar manualmente desde la UI).
-- ============================================================
insert into project_editors (project_id, editor_id, role, cost) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'primary', null),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 'primary', null),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'primary', null),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111103', 'primary', null),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 'primary', null)
on conflict (project_id, role) do nothing;
