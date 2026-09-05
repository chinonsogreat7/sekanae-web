create table if not exists admin_saved_work (
  id uuid primary key,
  actor_email text not null,
  kind text not null check (kind in ('order_view', 'csv_review')),
  name text not null,
  payload jsonb not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_saved_work_owner_kind_idx on admin_saved_work (actor_email, kind, updated_at desc);
