create table if not exists saved_carts (
  email text primary key references customer_profiles(email) on delete cascade,
  currency text not null default 'EUR' check (currency in ('USD', 'GBP', 'EUR', 'NGN', 'AED')),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_reminder_sent_at timestamptz,
  converted_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_carts_updated_at_idx on saved_carts(updated_at);
create index if not exists saved_carts_reminder_ready_idx on saved_carts(reminder_count, updated_at)
  where converted_at is null and cleared_at is null;

create table if not exists cart_reminder_suppressions (
  email text primary key,
  token text not null unique,
  suppressed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cart_reminder_suppressions_token_idx on cart_reminder_suppressions(token);
