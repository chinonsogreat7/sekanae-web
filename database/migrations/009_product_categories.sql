create table if not exists product_categories (
  id text primary key,
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into product_categories (id, name, sort_order, active)
values
  ('jewelry', 'Jewelry', 0, true),
  ('handbags', 'Handbags', 1, true),
  ('scarves', 'Scarves', 2, true),
  ('sunglasses', 'Sunglasses', 3, true),
  ('leather-goods', 'Leather Goods', 4, true),
  ('travel-accessories', 'Travel Accessories', 5, true),
  ('gift-shop', 'Gift Shop', 6, true)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into product_categories (id, name, sort_order, active)
select
  regexp_replace(lower(trim(category)), '[^a-z0-9]+', '-', 'g') as id,
  trim(category) as name,
  100 + row_number() over (order by trim(category)) as sort_order,
  true
from (
  select distinct category
  from products
  where trim(category) <> ''
) product_category_values
on conflict (id) do update set
  name = excluded.name,
  active = true,
  updated_at = now();

create index if not exists product_categories_active_sort_idx on product_categories(active, sort_order, name);
