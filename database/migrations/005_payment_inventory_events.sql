create table if not exists payment_events (
  id text primary key,
  provider text not null default 'stripe',
  event_type text not null,
  order_id text references orders(id) on delete set null,
  processed_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id text primary key,
  product_id text not null references products(id) on delete restrict,
  order_id text references orders(id) on delete set null,
  quantity_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_order_id_idx on payment_events(order_id);
create index if not exists inventory_movements_product_id_idx on inventory_movements(product_id);
create index if not exists inventory_movements_order_id_idx on inventory_movements(order_id);
