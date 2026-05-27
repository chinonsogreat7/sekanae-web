create table if not exists customer_profiles (
  email text primary key,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_login_codes (
  id text primary key,
  email text not null,
  first_name text,
  last_name text,
  code_hash text not null,
  code_salt text not null,
  purpose text not null check (purpose in ('create', 'sign-in')),
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_login_codes_email_idx on customer_login_codes(lower(email), created_at desc);
create index if not exists customer_login_codes_expires_at_idx on customer_login_codes(expires_at);

create table if not exists customer_sessions (
  id text primary key,
  email text not null references customer_profiles(email) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_sessions_email_idx on customer_sessions(lower(email), created_at desc);
create index if not exists customer_sessions_expires_at_idx on customer_sessions(expires_at);
