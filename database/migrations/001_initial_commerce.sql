create table if not exists collections (
  id text primary key,
  title text not null,
  description text not null,
  image_url text not null,
  cta text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  slug text not null unique,
  name text not null,
  category text not null,
  collection text not null,
  price_cents integer not null check (price_cents >= 0),
  material text not null,
  description text not null,
  details_materials text not null,
  details_dimensions text not null,
  details_care text not null,
  details_shipping text not null,
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews integer not null default 0 check (reviews >= 0),
  is_new boolean not null default false,
  is_bridal_preview boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_images (
  product_id text not null references products(id) on delete cascade,
  url text not null,
  alt text not null,
  sort_order integer not null default 0,
  primary key (product_id, url)
);

create table if not exists product_colors (
  product_id text not null references products(id) on delete cascade,
  color text not null,
  sort_order integer not null default 0,
  primary key (product_id, color)
);

create table if not exists product_occasions (
  product_id text not null references products(id) on delete cascade,
  occasion text not null,
  sort_order integer not null default 0,
  primary key (product_id, occasion)
);

create table if not exists inventory (
  product_id text primary key references products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_category_idx on products(active, category);
create index if not exists products_active_collection_idx on products(active, collection);
create index if not exists products_active_slug_idx on products(active, slug);
create index if not exists product_colors_color_idx on product_colors(color);
create index if not exists product_occasions_occasion_idx on product_occasions(occasion);
