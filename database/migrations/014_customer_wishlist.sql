create table if not exists customer_wishlist (
  email text not null references customer_profiles(email) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (email, product_id)
);

create index if not exists customer_wishlist_product_idx on customer_wishlist(product_id);
