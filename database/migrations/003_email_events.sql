create table if not exists email_events (
  id text primary key,
  order_id text references orders(id) on delete set null,
  recipient text not null,
  template text not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_events_order_id_idx on email_events(order_id);
create index if not exists email_events_recipient_idx on email_events(lower(recipient));
create index if not exists email_events_created_at_idx on email_events(created_at desc);
