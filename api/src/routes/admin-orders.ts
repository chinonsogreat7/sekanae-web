import { orderFiltersSchema } from "../../../packages/admin/src/workflows.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAdminActorEmail, requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { recordAuditLog } from "../repositories/audit-repository.js";
import { openApiSchemas } from "../openapi/schemas.js";
import {
  getOrderById,
  listOrders,
  updateOrder,
  type OrderStatus,
  type PaymentStatus,
} from "../services/order-service.js";

const orderStatuses = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;
const paymentStatuses = ["unpaid", "requires_action", "paid", "failed", "refunded"] as const;

const orderListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const orderUpdateSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  paymentStatus: z.enum(paymentStatuses).optional(),
  paymentProvider: z.string().min(1).optional(),
  paymentReference: z.string().min(1).optional(),
  notes: z.string().max(1000).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be provided.",
});

export async function registerAdminOrderRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/orders", {
    schema: {
      tags: ["Admin"],
      summary: "List orders",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", maxLength: 200 },
          paymentStatus: { type: "string", enum: paymentStatuses },
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
          status: { type: "string", enum: orderStatuses },
          email: { type: "string", format: "email" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
      response: {
        200: openApiSchemas.orderListResponse,
        400: openApiSchemas.error,
        401: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request) => {
    const query = orderListQuerySchema.parse(request.query);
    const filters = orderFiltersSchema.parse(request.query);
    const { items, total } = await listOrders({
      ...query, ...filters,
      status: filters.status || undefined,
      paymentStatus: filters.paymentStatus || undefined,
    });

    return ok(items, { total, limit: query.limit, offset: query.offset });
  });

  app.get("/admin/orders/:id", {
    schema: {
      tags: ["Admin"],
      summary: "Get order",
      security: [{ bearerAuth: [] }],
      params: openApiSchemas.idParams,
      response: {
        200: openApiSchemas.orderResponse,
        401: openApiSchemas.error,
        404: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const order = await getOrderById(id);

    if (!order) {
      return reply.status(404).send({
        error: {
          code: "ORDER_NOT_FOUND",
          message: "Order not found.",
        },
      });
    }

    return ok(order);
  });

  app.patch("/admin/orders/:id", {
    schema: {
      tags: ["Admin"],
      summary: "Update order status",
      security: [{ bearerAuth: [] }],
      params: openApiSchemas.idParams,
      body: openApiSchemas.adminOrderUpdateBody,
      response: {
        200: openApiSchemas.orderResponse,
        400: openApiSchemas.error,
        401: openApiSchemas.error,
        404: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const payload = orderUpdateSchema.parse(request.body);
    const order = await updateOrder(id, {
      ...payload,
      status: payload.status as OrderStatus | undefined,
      paymentStatus: payload.paymentStatus as PaymentStatus | undefined,
    });

    if (!order) {
      return reply.status(404).send({
        error: {
          code: "ORDER_NOT_FOUND",
          message: "Order not found.",
        },
      });
    }

    await recordAuditLog({
      actorEmail: getAdminActorEmail(request),
      action: "update",
      entityType: "order",
      entityId: id,
      summary: `Updated order ${id}`,
      metadata: payload,
    });

    return ok(order);
  });
}
