import { getPool } from "../db/pool.js";
import { listOrdersFromDatabase } from "./order-repository.js";
import type { Order } from "../services/order-service.js";
import type { CurrencyCode } from "../services/pricing-service.js";

export type CustomerProfile = {
  email: string;
  name?: string;
  phone?: string;
  hasAccount: boolean;
  accountCreatedAt?: string;
  accountUpdatedAt?: string;
  activeSessionCount: number;
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
  has_account: boolean;
  account_created_at: Date | null;
  account_updated_at: Date | null;
  active_session_count: string;
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
    hasAccount: row.has_account,
    accountCreatedAt: row.account_created_at?.toISOString(),
    accountUpdatedAt: row.account_updated_at?.toISOString(),
    activeSessionCount: Number(row.active_session_count ?? 0),
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
    account_customers as (
      select
        lower(email) as email,
        concat_ws(' ', nullif(first_name, ''), nullif(last_name, '')) as name,
        created_at as account_created_at,
        updated_at as account_updated_at
      from customer_profiles
    ),
    active_sessions as (
      select
        lower(email) as email,
        count(*)::text as active_session_count
      from customer_sessions
      where revoked_at is null
        and expires_at > now()
      group by lower(email)
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
    customer_emails as (
      select email from order_customers
      union
      select email from account_customers
      union
      select email from newsletter_customers
    ),
    merged_customers as (
      select
        e.email,
        coalesce(nullif(a.name, ''), o.name, n.name) as name,
        o.phone,
        (a.email is not null) as has_account,
        a.account_created_at,
        a.account_updated_at,
        coalesce(s.active_session_count, '0') as active_session_count,
        n.newsletter_status,
        n.newsletter_source,
        coalesce(o.order_count, n.order_count, '0') as order_count,
        coalesce(o.total_spend_cents, n.total_spend_cents, '0') as total_spend_cents,
        o.currency,
        o.last_order_at,
        coalesce(o.first_seen_at, a.account_created_at, n.first_seen_at) as first_seen_at
      from customer_emails e
      left join order_customers o on o.email = e.email
      left join account_customers a on a.email = e.email
      left join active_sessions s on s.email = e.email
      left join newsletter_customers n on n.email = e.email
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
