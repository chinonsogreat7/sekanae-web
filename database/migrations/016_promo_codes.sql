create table if not exists promo_codes (
  code text primary key check (code ~ '^[A-Z0-9_-]{1,40}$'),
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  minimum_subtotal_cents integer not null default 0 check (minimum_subtotal_cents >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0 and discount_cents <= subtotal_cents),
  add column if not exists promo_code text;
