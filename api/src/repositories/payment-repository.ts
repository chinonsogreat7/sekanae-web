import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";
import {
  mapOrderFromRows,
  type OrderItemRow,
  type OrderRow,
} from "./order-repository.js";
import type { Order } from "../services/order-service.js";

export type CompleteStripePaymentInput = {
  eventId: string;
  eventType: string;
  orderId: string;
  paymentReference: string;
};

export type CompleteStripePaymentResult = {
  order?: Order;
  alreadyProcessed: boolean;
};

export async function completeStripePaymentInDatabase(input: CompleteStripePaymentInput): Promise<CompleteStripePaymentResult> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const eventResult = await client.query(
      `
        insert into payment_events (id, provider, event_type, order_id)
        values ($1, 'stripe', $2, $3)
        on conflict (id) do nothing
      `,
      [input.eventId, input.eventType, input.orderId],
    );

    if (!eventResult.rowCount) {
      await client.query("commit");
      return { alreadyProcessed: true };
    }

    const existingOrderResult = await client.query<OrderRow>(
      `
        select *
        from orders
        where id = $1
        for update
      `,
      [input.orderId],
    );

    const existingOrder = existingOrderResult.rows[0];

    if (!existingOrder) {
      await client.query("commit");
      return { alreadyProcessed: false };
    }

    if (existingOrder.payment_status === "paid") {
      const itemsResult = await client.query<OrderItemRow>(
        `
          select *
          from order_items
          where order_id = $1
          order by created_at asc
        `,
        [input.orderId],
      );

      await client.query("commit");
      return {
        order: mapOrderFromRows(existingOrder, itemsResult.rows),
        alreadyProcessed: true,
      };
    }

    const itemsResult = await client.query<OrderItemRow>(
      `
        select *
        from order_items
        where order_id = $1
        order by created_at asc
      `,
      [input.orderId],
    );

    for (const item of itemsResult.rows) {
      const inventoryResult = await client.query<{ quantity: number }>(
        `
          update inventory
          set
            quantity = quantity - $2,
            updated_at = now()
          where product_id = $1 and quantity >= $2
          returning quantity
        `,
        [item.product_id, item.quantity],
      );

      if (!inventoryResult.rows[0]) {
        throw new Error(`Insufficient inventory for product ${item.product_id}.`);
      }

      await client.query(
        `
          insert into inventory_movements (id, product_id, order_id, quantity_delta, reason)
          values ($1, $2, $3, $4, $5)
        `,
        [randomUUID(), item.product_id, input.orderId, -item.quantity, "stripe_checkout_paid"],
      );
    }

    const updatedOrderResult = await client.query<OrderRow>(
      `
        update orders
        set
          status = 'paid',
          payment_status = 'paid',
          payment_provider = 'stripe',
          payment_reference = $2,
          updated_at = now()
        where id = $1
        returning *
      `,
      [input.orderId, input.paymentReference],
    );

    await client.query("commit");

    return {
      order: mapOrderFromRows(updatedOrderResult.rows[0], itemsResult.rows),
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
