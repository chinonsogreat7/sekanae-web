import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/admin.js";
import { ok } from "../http.js";
import { getCustomerByEmailFromDatabase, listCustomersFromDatabase } from "../repositories/customer-repository.js";

const customerListQuerySchema = z.object({
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const customerParamsSchema = z.object({
  email: z.string().email(),
});

export async function registerAdminCustomerRoutes(app: FastifyInstance) {
  app.addHook("preValidation", requireAdmin);

  app.get("/admin/customers", {
    schema: {
      tags: ["Admin"],
      summary: "List customers",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", minLength: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const query = customerListQuerySchema.parse(request.query);
    const { items, total } = await listCustomersFromDatabase(query);

    return ok(items, { total, limit: query.limit, offset: query.offset });
  });

  app.get("/admin/customers/:email", {
    schema: {
      tags: ["Admin"],
      summary: "Get customer profile",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
    },
  }, async (request, reply) => {
    const { email } = customerParamsSchema.parse(request.params);
    const customer = await getCustomerByEmailFromDatabase(email);

    if (!customer) {
      return reply.status(404).send({
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message: "Customer not found.",
        },
      });
    }

    return ok(customer);
  });
}
