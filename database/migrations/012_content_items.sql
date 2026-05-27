create table if not exists content_items (
  id text primary key,
  title text not null,
  content_type text not null check (content_type in ('journal', 'newsletter', 'homepage', 'social', 'product_story')),
  channel text not null check (channel in ('website', 'email', 'homepage', 'instagram')),
  status text not null default 'idea' check (status in ('idea', 'drafting', 'ready', 'scheduled', 'published', 'archived')),
  publish_at timestamptz,
  owner text,
  brief text,
  cta_label text,
  cta_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_status_idx on content_items(status);
create index if not exists content_items_publish_at_idx on content_items(publish_at asc nulls last);
