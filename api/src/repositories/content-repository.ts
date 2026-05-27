import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";

export type ContentType = "journal" | "newsletter" | "homepage" | "social" | "product_story";
export type ContentChannel = "website" | "email" | "homepage" | "instagram";
export type ContentStatus = "idea" | "drafting" | "ready" | "scheduled" | "published" | "archived";

export type ContentItem = {
  id: string;
  title: string;
  contentType: ContentType;
  channel: ContentChannel;
  status: ContentStatus;
  publishAt?: string;
  owner?: string;
  brief?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type ContentItemRow = {
  id: string;
  title: string;
  content_type: ContentType;
  channel: ContentChannel;
  status: ContentStatus;
  publish_at: Date | null;
  owner: string | null;
  brief: string | null;
  cta_label: string | null;
  cta_url: string | null;
  created_at: Date;
  updated_at: Date;
};

type ContentWrite = {
  id?: string;
  title: string;
  contentType: ContentType;
  channel: ContentChannel;
  status: ContentStatus;
  publishAt?: string;
  owner?: string;
  brief?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

type ContentPatch = Partial<Omit<ContentWrite, "id">>;

function mapContentItem(row: ContentItemRow): ContentItem {
  return {
    id: row.id,
    title: row.title,
    contentType: row.content_type,
    channel: row.channel,
    status: row.status,
    publishAt: row.publish_at?.toISOString(),
    owner: row.owner ?? undefined,
    brief: row.brief ?? undefined,
    ctaLabel: row.cta_label ?? undefined,
    ctaUrl: row.cta_url ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function nullableText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function listContentItemsFromDatabase(input: {
  status?: ContentStatus;
  limit?: number;
  offset?: number;
}) {
  const pool = getPool();
  const values: Array<string | number> = [];
  const where = ["active = true"];

  if (input.status) {
    values.push(input.status);
    where.push(`status = $${values.length}`);
  }

  const whereSql = `where ${where.join(" and ")}`;
  const limit = input.limit ?? 80;
  const offset = input.offset ?? 0;
  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from content_items ${whereSql}`,
    values,
  );
  const result = await pool.query<ContentItemRow>(
    `
      select *
      from content_items
      ${whereSql}
      order by
        case status
          when 'scheduled' then 1
          when 'ready' then 2
          when 'drafting' then 3
          when 'idea' then 4
          when 'published' then 5
          else 6
        end,
        publish_at asc nulls last,
        updated_at desc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  return {
    items: result.rows.map(mapContentItem),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function upsertContentItemInDatabase(input: ContentWrite) {
  const pool = getPool();
  const id = input.id?.trim() || randomUUID();
  const result = await pool.query<ContentItemRow>(
    `
      insert into content_items (
        id,
        title,
        content_type,
        channel,
        status,
        publish_at,
        owner,
        brief,
        cta_label,
        cta_url,
        active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      on conflict (id) do update set
        title = excluded.title,
        content_type = excluded.content_type,
        channel = excluded.channel,
        status = excluded.status,
        publish_at = excluded.publish_at,
        owner = excluded.owner,
        brief = excluded.brief,
        cta_label = excluded.cta_label,
        cta_url = excluded.cta_url,
        active = true,
        updated_at = now()
      returning *
    `,
    [
      id,
      input.title.trim(),
      input.contentType,
      input.channel,
      input.status,
      input.publishAt ? new Date(input.publishAt) : null,
      nullableText(input.owner),
      nullableText(input.brief),
      nullableText(input.ctaLabel),
      nullableText(input.ctaUrl),
    ],
  );

  return mapContentItem(result.rows[0]);
}

export async function updateContentItemInDatabase(id: string, input: ContentPatch) {
  const pool = getPool();
  const result = await pool.query<ContentItemRow>(
    `
      update content_items
      set
        title = coalesce($2::text, title),
        content_type = coalesce($3::text, content_type),
        channel = coalesce($4::text, channel),
        status = coalesce($5::text, status),
        publish_at = case when $6::boolean then $7::timestamptz else publish_at end,
        owner = case when $8::boolean then $9 else owner end,
        brief = case when $10::boolean then $11 else brief end,
        cta_label = case when $12::boolean then $13 else cta_label end,
        cta_url = case when $14::boolean then $15 else cta_url end,
        updated_at = now()
      where id = $1 and active = true
      returning *
    `,
    [
      id,
      input.title?.trim(),
      input.contentType,
      input.channel,
      input.status,
      Object.hasOwn(input, "publishAt"),
      input.publishAt ? new Date(input.publishAt) : null,
      Object.hasOwn(input, "owner"),
      nullableText(input.owner),
      Object.hasOwn(input, "brief"),
      nullableText(input.brief),
      Object.hasOwn(input, "ctaLabel"),
      nullableText(input.ctaLabel),
      Object.hasOwn(input, "ctaUrl"),
      nullableText(input.ctaUrl),
    ],
  );

  return result.rows[0] ? mapContentItem(result.rows[0]) : undefined;
}

export async function archiveContentItemInDatabase(id: string) {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `
      update content_items
      set active = false, status = 'archived', updated_at = now()
      where id = $1 and active = true
      returning id
    `,
    [id],
  );

  return Boolean(result.rows[0]);
}
