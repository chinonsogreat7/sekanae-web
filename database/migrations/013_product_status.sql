alter table products
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published'));

update products
set status = 'published'
where status is null;

create index if not exists products_active_status_idx on products(active, status);
