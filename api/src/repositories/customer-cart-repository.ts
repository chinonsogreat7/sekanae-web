import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";
import type { CurrencyCode } from "../services/pricing-service.js";

export type SavedCartItem = {
  productId: string;
  color: string;
  quantity: number;
  giftWrap: boolean;
};

export type SavedCart = {
  email: string;
  currency: CurrencyCode;
  items: SavedCartItem[];
  reminderCount: number;
  lastReminderSentAt?: string;
  convertedAt?: string;
  clearedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedCartProductSummary = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image?: string;
};

type SavedCartRow = {
  email: string;
  currency: CurrencyCode;
  items: SavedCartItem[];
  reminder_count: number;
  last_reminder_sent_at: Date | null;
  converted_at: Date | null;
  cleared_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ProductSummaryRow = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  image: string | null;
};

function mapSavedCart(row: SavedCartRow): SavedCart {
  return {
    email: row.email,
    currency: row.currency,
    items: row.items,
    reminderCount: row.reminder_count,
    lastReminderSentAt: row.last_reminder_sent_at?.toISOString(),
    convertedAt: row.converted_at?.toISOString(),
    clearedAt: row.cleared_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizeItems(items: SavedCartItem[]) {
  const normalized = items
    .filter((item) => item.productId.trim() && item.color.trim() && item.quantity > 0)
    .map((item) => ({
      productId: item.productId.trim(),
      color: item.color.trim(),
      quantity: Math.min(99, Math.max(1, Math.floor(item.quantity))),
      giftWrap: Boolean(item.giftWrap),
    }));

  const itemsByKey = new Map<string, SavedCartItem>();

  for (const item of normalized) {
    const key = `${item.productId}::${item.color}`;
    const current = itemsByKey.get(key);

    itemsByKey.set(key, current
      ? {
          ...current,
          quantity: Math.min(99, current.quantity + item.quantity),
          giftWrap: current.giftWrap || item.giftWrap,
        }
      : item);
  }

  return [...itemsByKey.values()];
}

export async function getCustomerCartFromDatabase(email: string): Promise<SavedCart | undefined> {
  const pool = getPool();
  const result = await pool.query<SavedCartRow>(
    "select * from saved_carts where lower(email) = lower($1) limit 1",
    [email],
  );

  return result.rows[0] ? mapSavedCart(result.rows[0]) : undefined;
}

export async function replaceCustomerCartInDatabase(email: string, currency: CurrencyCode, items: SavedCartItem[]): Promise<SavedCart> {
  const pool = getPool();
  const normalizedItems = normalizeItems(items);

  if (normalizedItems.length === 0) {
    const result = await pool.query<SavedCartRow>(
      `
        insert into saved_carts (email, currency, items, cleared_at, updated_at)
        values (lower($1), $2, '[]'::jsonb, now(), now())
        on conflict (email) do update set
          currency = excluded.currency,
          items = '[]'::jsonb,
          cleared_at = now(),
          converted_at = null,
          reminder_count = 0,
          last_reminder_sent_at = null,
          updated_at = now()
        returning *
      `,
      [email, currency],
    );

    return mapSavedCart(result.rows[0]);
  }

  const result = await pool.query<SavedCartRow>(
    `
      insert into saved_carts (email, currency, items, updated_at)
      values (lower($1), $2, $3::jsonb, now())
      on conflict (email) do update set
        currency = excluded.currency,
        items = excluded.items,
        cleared_at = null,
        converted_at = null,
        reminder_count = case
          when saved_carts.currency is distinct from excluded.currency
            or saved_carts.items is distinct from excluded.items
            or saved_carts.cleared_at is not null
            or saved_carts.converted_at is not null
          then 0
          else saved_carts.reminder_count
        end,
        last_reminder_sent_at = case
          when saved_carts.currency is distinct from excluded.currency
            or saved_carts.items is distinct from excluded.items
            or saved_carts.cleared_at is not null
            or saved_carts.converted_at is not null
          then null
          else saved_carts.last_reminder_sent_at
        end,
        updated_at = case
          when saved_carts.currency is distinct from excluded.currency
            or saved_carts.items is distinct from excluded.items
            or saved_carts.cleared_at is not null
            or saved_carts.converted_at is not null
          then now()
          else saved_carts.updated_at
        end
      returning *
    `,
    [email, currency, JSON.stringify(normalizedItems)],
  );

  return mapSavedCart(result.rows[0]);
}

export async function clearCustomerCartInDatabase(email: string, currency: CurrencyCode = "EUR"): Promise<SavedCart> {
  return replaceCustomerCartInDatabase(email, currency, []);
}

export async function markCustomerCartConvertedInDatabase(email: string) {
  const pool = getPool();
  await pool.query(
    `
      update saved_carts
      set converted_at = now(),
        updated_at = now()
      where lower(email) = lower($1)
        and jsonb_array_length(items) > 0
    `,
    [email],
  );
}

export async function listSavedCartsReadyForReminder(limit = 50): Promise<SavedCart[]> {
  const pool = getPool();
  const result = await pool.query<SavedCartRow>(
    `
      select sc.*
      from saved_carts sc
      left join cart_reminder_suppressions crs on lower(crs.email) = lower(sc.email) and crs.suppressed_at is not null
      where jsonb_array_length(sc.items) > 0
        and sc.converted_at is null
        and sc.cleared_at is null
        and sc.reminder_count < 2
        and sc.updated_at <= now() - interval '6 hours'
        and sc.updated_at >= now() - interval '14 days'
        and crs.email is null
        and (
          sc.last_reminder_sent_at is null
          or sc.last_reminder_sent_at <= now() - interval '24 hours'
        )
      order by sc.updated_at asc
      limit $1
    `,
    [limit],
  );

  return result.rows.map(mapSavedCart);
}

export async function recordCartReminderSent(email: string) {
  const pool = getPool();
  await pool.query(
    `
      update saved_carts
      set reminder_count = reminder_count + 1,
        last_reminder_sent_at = now(),
        updated_at = updated_at
      where lower(email) = lower($1)
    `,
    [email],
  );
}

export async function getOrCreateCartReminderSuppressionToken(email: string) {
  const pool = getPool();
  const token = randomUUID();
  const result = await pool.query<{ token: string }>(
    `
      insert into cart_reminder_suppressions (email, token)
      values (lower($1), $2)
      on conflict (email) do update set email = excluded.email
      returning token
    `,
    [email, token],
  );

  return result.rows[0].token;
}

export async function suppressCartRemindersByToken(token: string) {
  const pool = getPool();
  const result = await pool.query<{ email: string }>(
    `
      update cart_reminder_suppressions
      set suppressed_at = now()
      where token = $1
      returning email
    `,
    [token],
  );

  if (!result.rows[0]) {
    return undefined;
  }

  return result.rows[0].email;
}

export async function listSavedCartProductSummaries(productIds: string[]): Promise<Map<string, SavedCartProductSummary>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const pool = getPool();
  const result = await pool.query<ProductSummaryRow>(
    `
      select
        p.id,
        p.slug,
        p.name,
        p.price_cents,
        (
          select pi.url
          from product_images pi
          where pi.product_id = p.id
          order by pi.sort_order asc
          limit 1
        ) as image
      from products p
      where p.active = true
        and p.status = 'published'
        and p.id = any($1::text[])
    `,
    [[...new Set(productIds)]],
  );

  return result.rows.reduce((summaries, row) => {
    summaries.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: row.price_cents / 100,
      image: row.image ?? undefined,
    });
    return summaries;
  }, new Map<string, SavedCartProductSummary>());
}
