import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateAdminCredentials, requireAdminToken } from "../auth/admin.js";
import { ok } from "../http.js";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerAdminAuthRoutes(app: FastifyInstance) {
  app.get("/admin/session", {
    preValidation: requireAdminToken,
    schema: {
      tags: ["Admin"],
      summary: "Validate admin session",
      description: "Validates the admin bearer token without requiring database access.",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          required: ["data"],
          properties: {
            data: {
              type: "object",
              required: ["authenticated"],
              properties: {
                authenticated: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  }, async () => ok({ authenticated: true }));

  app.post("/admin/session", {
    schema: {
      tags: ["Admin"],
      summary: "Create admin session",
      description: "Validates admin email and password credentials and returns a short-lived admin session token.",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1 },
        },
      },
      response: {
        200: {
          type: "object",
          required: ["data"],
          properties: {
            data: {
              type: "object",
              required: ["authenticated", "token", "email", "expiresAt"],
              properties: {
                authenticated: { type: "boolean" },
                token: { type: "string" },
                email: { type: "string" },
                expiresAt: { type: "string" },
              },
            },
          },
        },
        401: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        500: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const credentials = adminLoginSchema.parse(request.body);
    const result = authenticateAdminCredentials(credentials.email, credentials.password);

    if (!result.ok) {
      return reply.status(result.statusCode >= 500 ? 500 : 401).send({
        error: {
          code: result.code,
          message: result.message,
        },
      });
    }

    return ok({
      authenticated: true,
      token: result.token,
      email: result.email,
      expiresAt: result.expiresAt,
    });
  });
}
