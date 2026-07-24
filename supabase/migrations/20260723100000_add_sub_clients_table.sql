-- Tabla de subclientas para agrupar proyectos dentro de un pack.
-- Cada subcliente pertenece a un cliente padre (el que contrata el pack).
create table public.sub_clients (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references public.clients(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now(),
  unique(client_id, name)
);

alter table public.sub_clients enable row level security;

create policy "sub_clients full access" on public.sub_clients
  using (true) with check (true);
