-- ── Facturas / Invoices ────────────────────────────────────────────────────────
--
-- invoice_settings : configuración global (una sola fila).
-- invoices         : cabecera + totales de cada factura.
-- invoice_projects : join entre factura y proyectos que cubre.

-- 1. Configuración global de facturación
create table if not exists public.invoice_settings (
  id            int primary key default 1,
  constraint    invoice_settings_one_row check (id = 1),
  next_number   int  not null default 1,
  sender_name   text not null default 'Joaquín Martorano Perozzi',
  sender_address text not null default '',
  sender_city   text not null default '1876 Quilmes Oeste',
  sender_state  text not null default 'Buenos Aires',
  sender_country text not null default 'Argentina',
  sender_email  text not null default 'yoakodesign@gmail.com'
);

insert into public.invoice_settings (id)
values (1)
on conflict do nothing;

-- 2. Tabla de facturas
create table if not exists public.invoices (
  id               uuid        primary key default gen_random_uuid(),
  invoice_number   int         not null unique,
  invoice_code     text        not null unique,          -- 'INV-00001'
  date             date        not null,
  client_id        uuid        references public.clients(id) on delete set null,
  client_name      text        not null default '',
  client_address   text        not null default '',
  client_country   text        not null default '',
  currency_symbol  text        not null default '$',
  items            jsonb       not null default '[]'::jsonb,
  subtotal         numeric(12,2) not null default 0,
  -- Descuento
  discount_enabled  boolean   not null default false,
  discount_type     text      not null default 'percentage'
                              check (discount_type in ('percentage','fixed')),
  discount_value    numeric(12,2) not null default 0,
  discount_amount   numeric(12,2) not null default 0,
  -- Pago inicial (upfront)
  upfront_enabled    boolean  not null default false,
  upfront_percentage numeric(5,2) not null default 0,
  upfront_amount     numeric(12,2) not null default 0,
  -- Total final (balance due)
  total            numeric(12,2) not null default 0,
  notes            text,
  pdf_storage_path text,                                 -- path en el bucket 'invoices'
  created_at       timestamptz not null default now()
);

-- 3. Relación factura ↔ proyectos
create table if not exists public.invoice_projects (
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (invoice_id, project_id)
);

-- 4. Función atómica para reclamar el próximo número de factura
--    Incrementa el contador y devuelve el número asignado.
create or replace function public.claim_invoice_number()
returns int
language sql
security definer
as $$
  update public.invoice_settings
  set next_number = next_number + 1
  where id = 1
  returning next_number - 1;
$$;

-- 5. Índices
create index if not exists invoices_date_idx        on public.invoices(date desc);
create index if not exists invoices_client_id_idx   on public.invoices(client_id);
create index if not exists invoice_projects_proj_idx on public.invoice_projects(project_id);

-- 6. RLS
alter table public.invoices         enable row level security;
alter table public.invoice_projects enable row level security;
alter table public.invoice_settings enable row level security;

create policy "auth read invoices"   on public.invoices
  for select to authenticated using (true);
create policy "auth insert invoices" on public.invoices
  for insert to authenticated with check (true);
create policy "auth delete invoices" on public.invoices
  for delete to authenticated using (true);

create policy "auth read invoice_projects"   on public.invoice_projects
  for select to authenticated using (true);
create policy "auth insert invoice_projects" on public.invoice_projects
  for insert to authenticated with check (true);
create policy "auth delete invoice_projects" on public.invoice_projects
  for delete to authenticated using (true);

create policy "auth read invoice_settings"   on public.invoice_settings
  for select to authenticated using (true);
create policy "auth update invoice_settings" on public.invoice_settings
  for update to authenticated using (true);
