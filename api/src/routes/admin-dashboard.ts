import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { getPool } from "../db/pool.js";

export async function registerAdminDashboardRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/dashboard", {
    schema: {
      tags: ["Admin"],
      summary: "Get admin dashboard metrics",
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const pool = getPool();
    const [metricsResult, recentOrdersResult, lowInventoryResult] = await Promise.all([
      pool.query<{
        revenue_cents: string;
        order_count: string;
        customer_count: string;
        low_stock_count: string;
        newsletter_count: string;
      }>(`
        with customer_emails as (
          select lower(customer_email) as email from orders
          union
          select lower(email) as email from customer_profiles
          union
          select lower(email) as email from newsletter_subscribers
        )
        select
          coalesce((select sum(total_cents)::text from orders where payment_status = 'paid'), '0') as revenue_cents,
          coalesce((select count(*)::text from orders), '0') as order_count,
          coalesce((select count(*)::text from customer_emails), '0') as customer_count,
          coalesce((
            select count(*)::text
            from inventory i
            join products p on p.id = i.product_id
            where p.active = true
              and p.status = 'published'
              and i.quantity <= 5
          ), '0') as low_stock_count,
          coalesce((select count(*)::text from newsletter_subscribers where status = 'subscribed'), '0') as newsletter_count
      `),
      pool.query(`
        select id, customer_name, customer_email, currency, total_cents, status, created_at
        from orders
        order by created_at desc
        limit 6
      `),
      pool.query(`
        select p.id, p.name, p.slug, p.category, coalesce(i.quantity, 0) as stock
        from products p
        left join inventory i on i.product_id = p.id
        where p.active = true
          and p.status = 'published'
        order by coalesce(i.quantity, 0) asc, p.name asc
        limit 8
      `),
    ]);

    const metrics = metricsResult.rows[0];

    return ok({
      metrics: {
        revenue: Number(metrics?.revenue_cents ?? 0) / 100,
        orders: Number(metrics?.order_count ?? 0),
        customers: Number(metrics?.customer_count ?? 0),
        lowStock: Number(metrics?.low_stock_count ?? 0),
        newsletterSubscribers: Number(metrics?.newsletter_count ?? 0),
      },
      recentOrders: recentOrdersResult.rows.map((order) => ({
        id: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        currency: order.currency,
        total: Number(order.total_cents) / 100,
        status: order.status,
        createdAt: order.created_at.toISOString(),
      })),
      lowInventory: lowInventoryResult.rows.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        stock: Number(product.stock),
      })),
    });
  });
}
