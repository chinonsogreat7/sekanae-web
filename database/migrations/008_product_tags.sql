create table if not exists product_tags (
  product_id text not null references products(id) on delete cascade,
  tag text not null,
  sort_order integer not null default 0,
  primary key (product_id, tag)
);

insert into product_tags (product_id, tag, sort_order)
select id, 'New arrival', 0
from products
where is_new = true
on conflict (product_id, tag) do nothing;

insert into product_tags (product_id, tag, sort_order)
select id, 'Bridal preview', 1
from products
where is_bridal_preview = true
on conflict (product_id, tag) do nothing;

create index if not exists product_tags_tag_idx on product_tags(tag);
