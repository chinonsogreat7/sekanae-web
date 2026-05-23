create table if not exists orders (
  id text primary key,
  customer_email text not null,
  customer_name text not null,
  customer_phone text,
  currency text not null default 'EUR',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  tax_rate numeric(5, 4) not null default 0.18,
  tax_included boolean not null default true,
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'requires_action', 'paid', 'failed', 'refunded')),
  payment_provider text,
  payment_reference text,
  shipping_address jsonb not null,
  billing_address jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null,
  product_slug text not null,
  product_name text not null,
  color text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_email_idx on orders(lower(customer_email));
create index if not exists orders_created_at_idx on orders(created_at desc);
create index if not exists orders_status_idx on orders(status);
create index if not exists order_items_order_id_idx on order_items(order_id);
