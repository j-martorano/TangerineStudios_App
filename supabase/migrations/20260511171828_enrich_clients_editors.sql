-- Fase A de la spec del cliente:
-- Enriquece clients y editors con datos de calor (operativos) y fríos (admin/legales),
-- y agrega tabla pivot client_editors para la relación many-to-many.

-- ============================================================
-- Enum payment_type
-- ============================================================
create type payment_type as enum ('por_proyecto', 'mensual');

-- ============================================================
-- clients — agregar columnas
-- ============================================================
alter table clients
  add column color          text not null default '#FFAC37',
  add column payment_type   payment_type not null default 'por_proyecto',
  add column balance        numeric(12, 2) not null default 0,
  add column agreed_price   numeric(12, 2),
  add column billing_info   text,
  add column contact_method text,
  add column docs_url       text;

comment on column clients.color is 'Color de identificación (hex). Asignado aleatoriamente al crear, editable.';
comment on column clients.payment_type is 'por_proyecto: cobra por proyecto. mensual: abono mensual con saldo.';
comment on column clients.balance is 'Saldo (positivo a favor del cliente, negativo en contra). Solo relevante si payment_type=mensual.';
comment on column clients.agreed_price is 'Precio acordado base (por proyecto o por hora/minuto/mes según tipo).';
comment on column clients.billing_info is 'Datos de facturación libres (CUIT, razón social, dirección, etc).';
comment on column clients.contact_method is 'Medio de comunicación preferido (email, whatsapp, etc).';
comment on column clients.docs_url is 'URL a carpeta o documento con NDA/contrato.';

-- ============================================================
-- editors — agregar columnas
-- ============================================================
alter table editors
  add column bank_info      text,
  add column contact_method text,
  add column docs_url       text;

comment on column editors.bank_info is 'Cuenta bancaria, alias, CBU/CVU o ID equivalente para transferencias.';
comment on column editors.contact_method is 'Medio de comunicación preferido (email, whatsapp, etc).';
comment on column editors.docs_url is 'URL a carpeta o documento con NDA/contrato del editor.';

-- ============================================================
-- Tabla pivot client_editors (many-to-many)
-- ============================================================
create table client_editors (
  client_id   uuid not null references clients(id) on delete cascade,
  editor_id   uuid not null references editors(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, editor_id)
);

create index client_editors_client_idx on client_editors (client_id);
create index client_editors_editor_idx on client_editors (editor_id);

comment on table client_editors is 'Relación many-to-many cliente <-> editor. Un cliente puede tener varios editores asignados y viceversa.';

-- ============================================================
-- Backfill: asignar colores aleatorios de una paleta a clientes existentes
-- ============================================================
do $$
declare
  palette text[] := array[
    '#FFAC37', '#FFB93F', '#ED254E', '#3B82F6', '#10B981',
    '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#F97316'
  ];
  rec record;
  idx int;
begin
  for rec in select id from clients order by created_at loop
    idx := 1 + floor(random() * array_length(palette, 1))::int;
    update clients set color = palette[idx] where id = rec.id;
  end loop;
end $$;

-- ============================================================
-- Backfill: para cada proyecto existente con editor asignado,
-- crear la relación cliente <-> editor en la pivot.
-- ============================================================
insert into client_editors (client_id, editor_id)
select distinct p.client_id, p.editor_id
from projects p
where p.client_id is not null
  and p.editor_id is not null
on conflict do nothing;
