import { getPool } from "../db/pool.js";
import { listOrdersFromDatabase } from "./order-repository.js";
import type { Order } from "../services/order-service.js";
import type { CurrencyCode } from "../services/pricing-service.js";

export type CustomerProfile = {
  email: string;
  name?: string;
  phone?: string;
  newsletterStatus?: "subscribed" | "unsubscribed";
  newsletterSource?: string;
  orderCount: number;
  totalSpend: number;
  currency?: CurrencyCode;
  lastOrderAt?: string;
  firstSeenAt?: string;
  orders?: Order[];
};

type CustomerRow = {
  email: string;
  name: string | null;
  phone: string | null;
  newsletter_status: "subscribed" | "unsubscribed" | null;
  newsletter_source: string | null;
  order_count: string;
  total_spend_cents: string;
  currency: CurrencyCode | null;
  last_order_at: Date | null;
  first_seen_at: Date | null;
};

export type CustomerListFilters = {
  q?: string;
  limit?: number;
  offset?: number;
};

function fromCents(amount: number) {
  return amount / 100;
}

function mapCustomer(row: CustomerRow): CustomerProfile {
  const orderCount = Number(row.order_count ?? 0);

  return {
    email: row.email,
    name: row.name ?? undefined,
    phone: row.phone ?? undefined,
    newsletterStatus: row.newsletter_status ?? undefined,
    newsletterSource: row.newsletter_source ?? undefined,
    orderCount,
    totalSpend: fromCents(Number(row.total_spend_cents ?? 0)),
    currency: row.currency ?? undefined,
    lastOrderAt: row.last_order_at?.toISOString(),
    firstSeenAt: row.first_seen_at?.toISOString(),
  };
}

function buildCustomerWhere(q: string | undefined) {
  const values: string[] = [];
  const where: string[] = [];

  if (q?.trim()) {
    values.push(`%${q.trim()}%`);
    where.push(`(email ilike $${values.length} or name ilike $${values.length} or phone ilike $${values.length})`);
  }

  return {
    values,
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
  };
}

export async function listCustomersFromDatabase(filters: CustomerListFilters): Promise<{ items: CustomerProfile[]; total: number }> {
  const pool = getPool();
  const { values, whereSql } = buildCustomerWhere(filters.q);
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const customerSql = `
    with order_customers as (
      select
        lower(customer_email) as email,
        (array_agg(customer_name order by created_at desc))[1] as name,
        (array_agg(customer_phone order by created_at desc))[1] as phone,
        count(*)::text as order_count,
        coalesce(sum(total_cents), 0)::text as total_spend_cents,
        (array_agg(currency order by created_at desc))[1] as currency,
        max(created_at) as last_order_at,
        min(created_at) as first_seen_at
      from orders
      group by lower(customer_email)
    ),
    newsletter_customers as (
      select
        lower(email) as email,
        name,
        null::text as phone,
        status as newsletter_status,
        source as newsletter_source,
        '0'::text as order_count,
        '0'::text as total_spend_cents,
        null::text as currency,
        null::timestamptz as last_order_at,
        created_at as first_seen_at
      from newsletter_subscribers
    ),
    merged_customers as (
      select
        coalesce(o.email, n.email) as email,
        coalesce(o.name, n.name) as name,
        o.phone,
        n.newsletter_status,
        n.newsletter_source,
        coalesce(o.order_count, n.order_count) as order_count,
        coalesce(o.total_spend_cents, n.total_spend_cents) as total_spend_cents,
        o.currency,
        o.last_order_at,
        coalesce(o.first_seen_at, n.first_seen_at) as first_seen_at
      from order_customers o
      full outer join newsletter_customers n on n.email = o.email
    )
    select *
    from merged_customers
    ${whereSql}
  `;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from (${customerSql}) customers`,
    values,
  );

  const customerResult = await pool.query<CustomerRow>(
    `
      ${customerSql}
      order by coalesce(last_order_at, first_seen_at) desc nulls last, email asc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  return {
    items: customerResult.rows.map(mapCustomer),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function getCustomerByEmailFromDatabase(email: string): Promise<CustomerProfile | undefined> {
  const { items } = await listCustomersFromDatabase({ q: email, limit: 100, offset: 0 });
  const customer = items.find((item) => item.email.toLowerCase() === email.toLowerCase());

  if (!customer) {
    return undefined;
  }

  const { items: orders } = await listOrdersFromDatabase({ email, limit: 100, offset: 0 });
  return {
    ...customer,
    orders,
  };
}
