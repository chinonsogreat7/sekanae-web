import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import { openApiSchemas } from "../openapi/schemas.js";
import { createOrder, getOrderForCustomer, OrderServiceError } from "../services/order-service.js";

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().min(1).optional(),
  city: z.string().min(1),
  region: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  country: z.string().min(2),
});

const createOrderSchema = z.object({
  currency: z.enum(["USD", "GBP", "EUR", "NGN", "AED"]).optional(),
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    phone: z.string().min(1).optional(),
  }),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    color: z.string().min(1).optional(),
  })).min(1).max(50),
  notes: z.string().max(1000).optional(),
  marketingOptIn: z.boolean().optional(),
});

const orderLookupParamsSchema = z.object({
  id: z.string().uuid(),
});

const orderLookupQuerySchema = z.object({
  email: z.string().email(),
});

function sendOrderServiceError(error: OrderServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

export async function registerOrderRoutes(app: FastifyInstance) {
  app.post("/orders", {
    schema: {
      tags: ["Orders"],
      summary: "Create order",
      description: "Creates a pending guest order from cart items after server-side availability and price validation.",
      body: openApiSchemas.createOrderBody,
      response: {
        200: openApiSchemas.orderResponse,
        400: openApiSchemas.error,
        409: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    try {
      const payload = createOrderSchema.parse(request.body);
      return ok(await createOrder(payload));
    } catch (error) {
      if (error instanceof OrderServiceError) {
        return reply.status(error.statusCode === 409 ? 409 : 503).send(sendOrderServiceError(error));
      }

      throw error;
    }
  });

  app.get("/orders/:id", {
    schema: {
      tags: ["Orders"],
      summary: "Get customer order",
      description: "Returns a guest order only when the caller provides the matching customer email address.",
      params: openApiSchemas.idParams,
      querystring: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      response: {
        200: openApiSchemas.orderResponse,
        400: openApiSchemas.error,
        404: openApiSchemas.error,
        503: openApiSchemas.error,
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = orderLookupParamsSchema.parse(request.params);
      const { email } = orderLookupQuerySchema.parse(request.query);
      const order = await getOrderForCustomer(id, email);

      if (!order) {
        return reply.status(404).send({
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Order not found.",
          },
        });
      }

      return ok(order);
    } catch (error) {
      if (error instanceof OrderServiceError) {
        return reply.status(503).send(sendOrderServiceError(error));
      }

      throw error;
    }
  });
}
