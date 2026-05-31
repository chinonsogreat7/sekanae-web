import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import {
  clearCustomerCartInDatabase,
  getCustomerCartFromDatabase,
  replaceCustomerCartInDatabase,
} from "../repositories/customer-cart-repository.js";
import { CustomerAuthServiceError, getCustomerSession } from "../services/customer-auth-service.js";
import type { CurrencyCode } from "../services/pricing-service.js";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  color: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  giftWrap: z.boolean().default(false),
});

const cartBodySchema = z.object({
  currency: z.enum(["USD", "GBP", "EUR", "NGN", "AED"]).default("EUR"),
  items: z.array(cartItemSchema).max(100),
});

function tokenFromRequest(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new CustomerAuthServiceError("SESSION_NOT_FOUND", "Customer session not found.", 401);
  }

  return authorization.slice("Bearer ".length).trim();
}

function authError(error: CustomerAuthServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}

async function customerEmailFromRequest(request: FastifyRequest) {
  const session = await getCustomerSession(tokenFromRequest(request));
  return session.customer.email;
}

export async function registerCustomerCartRoutes(app: FastifyInstance) {
  app.get("/customer/cart", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Get customer saved cart",
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const email = await customerEmailFromRequest(request);
      const cart = await getCustomerCartFromDatabase(email);
      return ok({
        currency: cart?.currency ?? "EUR",
        items: cart?.items ?? [],
      });
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });

  app.put("/customer/cart", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Replace customer saved cart",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["items"],
        properties: {
          currency: { type: "string", enum: ["USD", "GBP", "EUR", "NGN", "AED"] },
          items: {
            type: "array",
            maxItems: 100,
            items: {
              type: "object",
              required: ["productId", "color", "quantity"],
              properties: {
                productId: { type: "string", minLength: 1 },
                color: { type: "string", minLength: 1 },
                quantity: { type: "integer", minimum: 1, maximum: 99 },
                giftWrap: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const email = await customerEmailFromRequest(request);
      const payload = cartBodySchema.parse(request.body);
      const cart = await replaceCustomerCartInDatabase(email, payload.currency as CurrencyCode, payload.items);
      return ok({ currency: cart.currency, items: cart.items });
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });

  app.delete("/customer/cart", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Clear customer saved cart",
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const email = await customerEmailFromRequest(request);
      const cart = await clearCustomerCartInDatabase(email);
      return ok({ currency: cart.currency, items: cart.items });
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });
}
