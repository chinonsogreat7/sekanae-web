create table if not exists concierge_requests (
  id text primary key,
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  reply_status text not null default 'not_replied' check (reply_status in ('not_replied', 'reply_needed', 'replied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists concierge_requests_status_idx on concierge_requests(status);
create index if not exists concierge_requests_created_at_idx on concierge_requests(created_at desc);

create table if not exists store_settings (
  key text primary key,
  value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

create table if not exists admin_password_overrides (
  id text primary key default 'primary',
  password_hash text not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint admin_password_singleton check (id = 'primary')
);
