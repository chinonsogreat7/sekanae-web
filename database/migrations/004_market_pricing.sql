alter table orders
  add column if not exists tax_rate numeric(5, 4) not null default 0.18,
  add column if not exists tax_included boolean not null default true;

alter table orders
  alter column currency set default 'EUR';
