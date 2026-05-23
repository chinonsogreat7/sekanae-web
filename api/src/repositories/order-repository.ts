import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";
import type {
  AddressInput,
  CreateOrderInput,
  Order,
  OrderItem,
  OrderListFilters,
  OrderStatus,
  PaymentStatus,
  UpdateOrderInput,
} from "../services/order-service.js";
import type { CurrencyCode } from "../services/pricing-service.js";

export type OrderRow = {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  currency: CurrencyCode;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  tax_rate: string;
  tax_included: boolean;
  total_cents: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_reference: string | null;
  shipping_address: AddressInput;
  billing_address: AddressInput | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  color: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(amount: number) {
  return amount / 100;
}

export function mapOrderFromRows(row: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: row.id,
    customer: {
      email: row.customer_email,
      name: row.customer_name,
      phone: row.customer_phone ?? undefined,
    },
    currency: row.currency,
    subtotal: fromCents(row.subtotal_cents),
    shipping: fromCents(row.shipping_cents),
    tax: fromCents(row.tax_cents),
    total: fromCents(row.total_cents),
    taxRate: Number(row.tax_rate),
    taxIncluded: row.tax_included,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider ?? undefined,
    paymentReference: row.payment_reference ?? undefined,
    shippingAddress: row.shipping_address,
    billingAddress: row.billing_address ?? undefined,
    notes: row.notes ?? undefined,
    items: items.map(mapOrderItem),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    slug: row.product_slug,
    name: row.product_name,
    color: row.color,
    quantity: row.quantity,
    unitPrice: fromCents(row.unit_price_cents),
    lineTotal: fromCents(row.line_total_cents),
  };
}

async function getOrderItems(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, OrderItemRow[]>();

  const pool = getPool();
  const result = await pool.query<OrderItemRow>(
    `
      select *
      from order_items
      where order_id = any($1::text[])
      order by created_at asc
    `,
    [orderIds],
  );

  return result.rows.reduce((itemsByOrderId, item) => {
    const items = itemsByOrderId.get(item.order_id) ?? [];
    items.push(item);
    itemsByOrderId.set(item.order_id, items);
    return itemsByOrderId;
  }, new Map<string, OrderItemRow[]>());
}

export async function createOrderInDatabase(input: CreateOrderInput): Promise<Order> {
  const pool = getPool();
  const client = await pool.connect();
  const orderId = randomUUID();
  const subtotalCents = toCents(input.subtotal);
  const shippingCents = toCents(input.shipping ?? 0);
  const taxCents = toCents(input.tax ?? 0);
  const totalCents = toCents(input.total);

  try {
    await client.query("begin");

    const orderResult = await client.query<OrderRow>(
      `
        insert into orders (
          id,
          customer_email,
          customer_name,
          customer_phone,
          currency,
          subtotal_cents,
          shipping_cents,
          tax_cents,
          tax_rate,
          tax_included,
          total_cents,
          shipping_address,
          billing_address,
          notes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        returning *
      `,
      [
        orderId,
        input.customer.email.toLowerCase(),
        input.customer.name,
        input.customer.phone,
        input.currency,
        subtotalCents,
        shippingCents,
        taxCents,
        input.taxRate,
        input.taxIncluded,
        totalCents,
        input.shippingAddress,
        input.billingAddress,
        input.notes,
      ],
    );

    for (const item of input.items) {
      await client.query(
        `
          insert into order_items (
            id,
            order_id,
            product_id,
            product_slug,
            product_name,
            color,
            quantity,
            unit_price_cents,
            line_total_cents
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          orderId,
          item.productId,
          item.slug,
          item.name,
          item.color,
          item.quantity,
          toCents(item.unitPrice),
          toCents(item.lineTotal),
        ],
      );
    }

    await client.query("commit");

    const items = await getOrderItems([orderId]);
    return mapOrderFromRows(orderResult.rows[0], items.get(orderId) ?? []);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrderForCustomerFromDatabase(orderId: string, email: string): Promise<Order | undefined> {
  const pool = getPool();
  const result = await pool.query<OrderRow>(
    `
      select *
      from orders
      where id = $1 and lower(customer_email) = lower($2)
      limit 1
    `,
    [orderId, email],
  );

  if (!result.rows[0]) return undefined;

  const items = await getOrderItems([orderId]);
  return mapOrderFromRows(result.rows[0], items.get(orderId) ?? []);
}

export async function getOrderByIdFromDatabase(orderId: string): Promise<Order | undefined> {
  const pool = getPool();
  const result = await pool.query<OrderRow>(
    "select * from orders where id = $1 limit 1",
    [orderId],
  );

  if (!result.rows[0]) return undefined;

  const items = await getOrderItems([orderId]);
  return mapOrderFromRows(result.rows[0], items.get(orderId) ?? []);
}

export async function listOrdersFromDatabase(filters: OrderListFilters): Promise<{ items: Order[]; total: number }> {
  const pool = getPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  if (filters.email) {
    values.push(filters.email);
    where.push(`lower(customer_email) = lower($${values.length})`);
  }

  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from orders ${whereSql}`,
    values,
  );

  const orderResult = await pool.query<OrderRow>(
    `
      select *
      from orders
      ${whereSql}
      order by created_at desc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  const itemsByOrderId = await getOrderItems(orderResult.rows.map((order) => order.id));

  return {
    items: orderResult.rows.map((order) => mapOrderFromRows(order, itemsByOrderId.get(order.id) ?? [])),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function updateOrderInDatabase(orderId: string, input: UpdateOrderInput): Promise<Order | undefined> {
  const pool = getPool();
  const result = await pool.query<OrderRow>(
    `
      update orders
      set
        status = coalesce($2, status),
        payment_status = coalesce($3, payment_status),
        payment_provider = coalesce($4, payment_provider),
        payment_reference = coalesce($5, payment_reference),
        notes = coalesce($6, notes),
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      orderId,
      input.status,
      input.paymentStatus,
      input.paymentProvider,
      input.paymentReference,
      input.notes,
    ],
  );

  if (!result.rows[0]) return undefined;

  const items = await getOrderItems([orderId]);
  return mapOrderFromRows(result.rows[0], items.get(orderId) ?? []);
}
