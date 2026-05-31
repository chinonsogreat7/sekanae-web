import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ok } from "../http.js";
import { listCustomerWishlistFromDatabase, replaceCustomerWishlistInDatabase } from "../repositories/customer-wishlist-repository.js";
import { CustomerAuthServiceError, getCustomerSession } from "../services/customer-auth-service.js";

const wishlistBodySchema = z.object({
  productIds: z.array(z.string().min(1)).max(100),
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

export async function registerCustomerWishlistRoutes(app: FastifyInstance) {
  app.get("/customer/wishlist", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Get customer wishlist",
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const email = await customerEmailFromRequest(request);
      return ok({ productIds: await listCustomerWishlistFromDatabase(email) });
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });

  app.put("/customer/wishlist", {
    schema: {
      tags: ["Customer Auth"],
      summary: "Replace customer wishlist",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["productIds"],
        properties: {
          productIds: { type: "array", maxItems: 100, items: { type: "string", minLength: 1 } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const email = await customerEmailFromRequest(request);
      const { productIds } = wishlistBodySchema.parse(request.body);
      return ok({ productIds: await replaceCustomerWishlistInDatabase(email, productIds) });
    } catch (error) {
      if (error instanceof CustomerAuthServiceError) {
        return reply.status(error.statusCode).send(authError(error));
      }

      throw error;
    }
  });
}
