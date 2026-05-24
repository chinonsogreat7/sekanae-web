create table if not exists newsletter_subscribers (
  email text primary key,
  name text,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text not null default 'storefront',
  unsubscribe_token text not null unique,
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_campaigns (
  id text primary key,
  subject text not null,
  preview_text text,
  html_body text not null,
  text_body text not null,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists newsletter_deliveries (
  id text primary key,
  campaign_id text not null references newsletter_campaigns(id) on delete cascade,
  subscriber_email text not null references newsletter_subscribers(email) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (campaign_id, subscriber_email)
);

create index if not exists newsletter_subscribers_status_idx on newsletter_subscribers(status);
create index if not exists newsletter_subscribers_created_at_idx on newsletter_subscribers(created_at desc);
create index if not exists newsletter_campaigns_created_at_idx on newsletter_campaigns(created_at desc);
create index if not exists newsletter_deliveries_campaign_id_idx on newsletter_deliveries(campaign_id);
